// Shared by local browser review and the private intake command.
// This is a transport check, not a full Khronos validator or historical approval.
export const MAX_GLB_BYTES = 512 * 1024 * 1024;
export function inspectGlb(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_GLB_BYTES) throw new Error('GLB must be between 20 bytes and 512 MiB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) throw new Error('Invalid GLB 2.0 header or file length.');
  let offset = 12, json = null, binaryBytes = 0, chunks = 0;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error('Truncated GLB chunk.');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    offset += 8;
    if (length % 4 || offset + length > bytes.byteLength) throw new Error('Invalid GLB chunk length.');
    if (chunks === 0 && type !== 0x4e4f534a) throw new Error('GLB JSON must be the first chunk.');
    if (type === 0x4e4f534a) {
      if (json) throw new Error('Duplicate GLB JSON chunk.');
      json = JSON.parse(new TextDecoder().decode(bytes.subarray(offset, offset + length)));
    } else if (type === 0x004e4942) {
      if (binaryBytes || chunks !== 1) throw new Error('Invalid GLB binary chunk.');
      binaryBytes = length;
    } else throw new Error('Unsupported GLB chunk.');
    chunks++; offset += length;
  }
  if (json?.asset?.version !== '2.0') throw new Error('A glTF 2.0 asset is required.');
  // Prevent a downloaded model from fetching arbitrary URLs during review.
  function checkUris(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'uri' && (typeof item !== 'string' || !item.startsWith('data:'))) throw new Error('Use a self-contained GLB with embedded resources; external URIs are blocked.');
      checkUris(item);
    }
  }
  checkUris(json);
  const buffers = json.buffers ?? [];
  if (buffers.length > 1 || buffers.some(b => b.uri || !Number.isInteger(b.byteLength) || b.byteLength < 0 || b.byteLength > binaryBytes || binaryBytes - b.byteLength > 3)) throw new Error('GLB must contain one valid embedded buffer.');
  const supported = new Set(['KHR_materials_unlit', 'KHR_materials_clearcoat', 'KHR_materials_transmission', 'KHR_materials_volume', 'KHR_materials_ior', 'KHR_materials_specular', 'KHR_materials_sheen', 'KHR_materials_iridescence', 'KHR_materials_anisotropy', 'KHR_materials_emissive_strength', 'KHR_materials_dispersion', 'KHR_texture_transform', 'KHR_mesh_quantization', 'EXT_mesh_gpu_instancing']);
  for (const extension of json.extensionsRequired ?? []) if (!supported.has(extension)) throw new Error(`Required extension ${extension} needs a separate decoder or adapter.`);
  let triangles = 0;
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
    const count = json.accessors?.[primitive.indices ?? primitive.attributes?.POSITION]?.count;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid mesh accessor count.');
    if ((primitive.mode ?? 4) === 4) {
      if (count % 3) throw new Error('Invalid triangle count.');
      triangles += count / 3;
    } else throw new Error('Only triangle meshes are supported by this intake.');
  }
  return {json, stats: {bytes: bytes.byteLength, meshDefinitions: (json.meshes ?? []).length, trianglesInMeshDefinitions: triangles, materials: (json.materials ?? []).length, animations: (json.animations ?? []).length, generator: json.asset.generator ?? null}};
}
