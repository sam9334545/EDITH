import { fail, ok } from '../../shared/contracts.js';
import * as postureService from '../services/postureService.js';

export async function getOverview(req, res) {
  const data = await postureService.getPostureOverview(req.query);
  return res.status(200).json(ok(data, 'Security posture overview retrieved successfully'));
}

export async function getApplications(req, res) {
  const data = await postureService.getPostureApplications(req.query);
  if (data === null) return res.status(404).json(fail('APP_NOT_FOUND', 'Application not found'));
  return res.status(200).json(ok(data, 'Application postures retrieved successfully'));
}

export async function getApplication(req, res) {
  const data = await postureService.getApplicationPosture(req.params.appId);
  if (!data) return res.status(404).json(fail('APP_NOT_FOUND', 'Application not found'));
  return res.status(200).json(ok(data, 'Application security posture retrieved successfully'));
}

export async function getFindings(req, res) {
  const data = await postureService.getPostureFindings(req.query);
  return res.status(200).json(ok(data, 'Security findings retrieved successfully'));
}

export async function getFinding(req, res) {
  const data = await postureService.getPostureFinding(req.params.id);
  if (!data) return res.status(404).json(fail('FINDING_NOT_FOUND', 'Finding not found'));
  return res.status(200).json(ok(data, 'Security finding retrieved successfully'));
}

export async function acknowledgeFinding(req, res) {
  const finding = await postureService.updateFindingStatus(req.params.id, 'acknowledge');
  return res.status(200).json(ok(finding, 'Security finding acknowledged successfully'));
}

export async function resolveFinding(req, res) {
  const finding = await postureService.updateFindingStatus(req.params.id, 'resolve');
  return res.status(200).json(ok(finding, 'Security finding resolved successfully'));
}

export async function getTrends(req, res) {
  const data = await postureService.getPostureTrends(req.query);
  return res.status(200).json(ok(data, 'Security posture trends retrieved successfully'));
}

export async function getRuntimeEvents(req, res) {
  const data = await postureService.getPostureRuntimeEvents(req.query);
  return res.status(200).json(ok(data, 'Posture runtime events retrieved successfully'));
}

export async function getIncidents(req, res) {
  const data = await postureService.getPostureIncidents(req.query);
  return res.status(200).json(ok(data, 'Security incidents retrieved successfully'));
}

export async function getIncident(req, res) {
  const result = await postureService.getPostureIncidents({ ...req.query, eventId: req.params.id, limit: 1 });
  if (!result.items.length) return res.status(404).json(fail('INCIDENT_NOT_FOUND', 'Incident not found'));
  return res.status(200).json(ok(result.items[0], 'Security incident retrieved successfully'));
}

export async function getPolicies(req, res) {
  const data = await postureService.getPosturePolicies();
  return res.status(200).json(ok(data, 'Security policies retrieved successfully'));
}

export async function updatePolicy(req, res) {
  const data = await postureService.updatePosturePolicy(req.params.ruleId, req.body);
  return res.status(200).json(ok(data, 'Security policy updated successfully'));
}

export default {
  getOverview,
  getApplications,
  getApplication,
  getFindings,
  getFinding,
  acknowledgeFinding,
  resolveFinding,
  getTrends,
  getRuntimeEvents,
  getIncidents,
  getIncident,
  getPolicies,
  updatePolicy,
};
