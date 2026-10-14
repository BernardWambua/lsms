import api from '../api';
import { errorMessage } from './errors';

// File downloads come back as blobs, so errors do too.
export async function blobErrorMessage(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return errorMessage({ response: { data: JSON.parse(await data.text()) } });
    } catch {
      return 'The download failed.';
    }
  }
  return errorMessage(err);
}

// Fetches `url` as a file and saves it as `filename`.
export async function downloadFile(url, params, filename) {
  const { data } = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
