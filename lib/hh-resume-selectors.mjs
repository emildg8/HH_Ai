/**
 * Селекторы UI резюме hh.ru (из data/hh-resume-probe.json).
 */

export const RESUME_LIST_URL = 'https://hh.ru/applicant/resumes';
export const RESUME_CREATE_URL = 'https://hh.ru/applicant/resumes/new';

export const RESUME_CREATE_BUTTON = [
  '[data-qa="resumeservice-button__createResumeHH"]',
  '[data-qa="mainmenu_createResume"]',
  'a[href*="/applicant/resumes/new"]',
];

export function resumeCardLink(hash) {
  return `[data-qa="resume-card-link-${hash}"]`;
}

export const EDIT_EXPERIENCE_BUTTON = (index = 0) => [
  `[data-qa="edit-experience-button-${index}"]`,
  `[data-qa="edit-experience-button-${index}-svg"]`,
];

export const EDIT_ABOUT_BUTTON = [
  '[data-qa="resume-about-edit"]',
  '[data-qa*="about-edit"]',
  'a[data-qa="link"]:has-text("Добавить")',
];

export const EDIT_TEXTAREA = [
  'textarea[data-qa*="edit"]',
  'textarea[data-qa*="about"]',
  'textarea[data-qa*="experience"]',
  'textarea[data-qa*="description"]',
  'textarea',
];

export const SAVE_BUTTON = [
  '[data-qa*="submit"]',
  '[data-qa="resume-save"]',
  'button[data-qa*="save"]',
];

export const RESUME_TITLE_INPUT = [
  'input[data-qa="resume-title-input"]',
  'input[name="title"]',
  'input[placeholder*="должност"]',
  'input[type="text"]',
];
