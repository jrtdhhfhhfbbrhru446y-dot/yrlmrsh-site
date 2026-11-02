// Repair the two printed labels using neighbouring plastic in the same UV islands.
// Sampling every PBR map also removes the paper's raised edge and different sheen.
const cleanPlastic = /* glsl */`
float archivePatchMask(vec2 pixel, vec2 low, vec2 high) {
  vec2 fadeIn = smoothstep(low, low + vec2(4.0), pixel);
  vec2 fadeOut = 1.0 - smoothstep(high - vec2(4.0), high, pixel);
  return fadeIn.x * fadeIn.y * fadeOut.x * fadeOut.y;
}
vec4 archivePlasticSample(sampler2D surfaceMap, vec2 uv) {
  vec4 original = texture2D(surfaceMap, uv);
  vec2 pixel = uv * 2048.0;
  float front = archivePatchMask(pixel, vec2(916.0, 976.0), vec2(1012.0, 1026.0));
  float back = archivePatchMask(pixel, vec2(1138.0, 1542.0), vec2(1198.0, 1653.0));
  if (front > 0.0) return mix(original, texture2D(surfaceMap, uv + vec2(0.0, 64.0 / 2048.0)), front);
  if (back > 0.0) return mix(original, texture2D(surfaceMap, uv - vec2(0.0, 128.0 / 2048.0)), back);
  return original;
}
`;

export function removeLaptopLabels(model, shaderChunks) {
  const materials = new Set();
  model.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material?.name === 'classic_laptop') materials.add(material);
    }
  });
  for (const material of materials) {
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + cleanPlastic);
      for (const name of ['map_fragment', 'normal_fragment_maps', 'roughnessmap_fragment', 'metalnessmap_fragment', 'aomap_fragment']) {
        const repaired = shaderChunks[name].replace(/texture2D\( (map|normalMap|roughnessMap|metalnessMap|aoMap), (v\w+Uv) \)/g, 'archivePlasticSample( $1, $2 )');
        shader.fragmentShader = shader.fragmentShader.replace(`#include <${name}>`, repaired);
      }
    };
    material.customProgramCacheKey = () => 'archive-clean-laptop-labels-v1';
    material.needsUpdate = true;
  }
}
