// Staff-only API calls. A 401 (expired/invalid crew session) sends the user back to sign in.
import { crewHeaders, logoutCrew } from './crewAuth.js';
import { ApiError } from './orderApi.js';

async function request(method, url, { body, form } = {}) {
  const headers = { ...crewHeaders() };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    logoutCrew();
    window.location.replace('index.html');
    throw new ApiError(401, json);
  }
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

// A plain <a href> can't send the crew token, so files are fetched with it and
// handed to the browser as a download.
async function download(path) {
  const res = await fetch(path, { headers: crewHeaders() });
  if (res.status === 401) {
    logoutCrew();
    window.location.replace('index.html');
    throw new ApiError(401, {});
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));

  const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '');
  const filename = match ? match[1] : 'download';
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return filename;
}

const classQuery = (classType) => (classType ? `?classType=${encodeURIComponent(classType)}` : '');

export const adminApi = {
  meta: () => request('GET', '/api/admin/meta'),

  summary: (classType) => request('GET', `/api/admin/reports/summary${classQuery(classType)}`),
  downloadExcel: (classType) => download(`/api/admin/export/orders.xlsx${classQuery(classType)}`),
  downloadPdf: (classType) => download(`/api/admin/export/orders.pdf${classQuery(classType)}`),

  listMeals: () => request('GET', '/api/admin/meals'),
  createMeal: (body) => request('POST', '/api/admin/meals', { body }),
  updateMeal: (id, body) => request('PUT', `/api/admin/meals/${id}`, { body }),
  deleteMeal: (id) => request('DELETE', `/api/admin/meals/${id}`),
  uploadImage(id, file) {
    const form = new FormData();
    form.append('image', file);
    return request('POST', `/api/admin/meals/${id}/image`, { form });
  },
  removeImage: (id) => request('DELETE', `/api/admin/meals/${id}/image`),

  listConditions: () => request('GET', '/api/admin/conditions'),
  createCondition: (body) => request('POST', '/api/admin/conditions', { body }),
  updateCondition: (id, body) => request('PUT', `/api/admin/conditions/${encodeURIComponent(id)}`, { body }),
  deleteCondition: (id) => request('DELETE', `/api/admin/conditions/${encodeURIComponent(id)}`),

  createTag: (body) => request('POST', '/api/admin/tags', { body }),
  deleteTag: (tag) => request('DELETE', `/api/admin/tags/${encodeURIComponent(tag)}`),
};
