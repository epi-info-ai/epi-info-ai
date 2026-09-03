export const EPI_ASSIST_MODELS = [
  {
    key: "granite-4.0-350m-wasm",
    modelId: "onnx-community/granite-4.0-350m-ONNX-web",
    label: "Granite 4.0 350M Instruct — CPU compatibility",
    device: "wasm",
    dtype: "q4",
    approximateSize: "576 MB",
  },
  {
    key: "granite-4.0-350m-webgpu",
    modelId: "onnx-community/granite-4.0-350m-ONNX-web",
    label: "Granite 4.0 350M Instruct — WebGPU",
    device: "webgpu",
    dtype: "fp16",
    approximateSize: "709 MB",
  },
  {
    key: "granite-4.0-1b",
    modelId: "onnx-community/granite-4.0-1b-ONNX-web",
    label: "Granite 4.0 1B Instruct — WebGPU",
    device: "webgpu",
    dtype: "q4",
    approximateSize: "1.78 GB",
  },
] as const;

export type EpiAssistModelKey = typeof EPI_ASSIST_MODELS[number]["key"];
export type EpiAssistDtype = typeof EPI_ASSIST_MODELS[number]["dtype"];
export type EpiAssistDevice = typeof EPI_ASSIST_MODELS[number]["device"];

export function epiAssistModel(key: string): typeof EPI_ASSIST_MODELS[number] {
  return EPI_ASSIST_MODELS.find((model) => model.key === key) ?? EPI_ASSIST_MODELS[0];
}
