import { environment as e } from '../../environments/environment';

export const API_URL = `${e.http}://${e.be_host}:${e.be_port}/${e.api_prefix}`;

export const SITE_URL = 'sites';
export const DATASET_URL = 'datasets';
export const ANNOTATIONS_URL = 'annotations';
export const RESOURCE_RUL = 'resources';

export const getApiUrl = () => API_URL;

export const getFullUrl = (relativeURL) => `${API_URL}/${relativeURL}`.replace(/[^:](\/{2,})/, (match, p1) => {
  return '/';
});
