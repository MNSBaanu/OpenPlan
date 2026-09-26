import OP from '../core';
import type { Project } from '../types';

const M = OP.model;

// [outline level, task name, duration in days (0 = milestone), predecessors by row ID]
type Line = [number, string, number, string?];

export interface Template { id: string; name: string; desc: string; tasks: Line[] }

export const TEMPLATES: Template[] = [
  {
    id: 'fyp', name: 'Final-year project', desc: 'Proposal, research and build, report and submission',
    tasks: [
      [1, 'Proposal', 1], [2, 'Choose topic and supervisor', 5], [2, 'Literature review', 10, '2'], [2, 'Write project proposal', 5, '3'],
      [2, 'Proposal approved', 0, '4'],
      [1, 'Research and build', 1], [2, 'Requirements and design', 10, '5'], [2, 'Build or run experiments', 25, '7'], [2, 'Testing and evaluation', 10, '8'],
      [1, 'Report', 1], [2, 'Write draft report', 15, '9'], [2, 'Supervisor feedback', 5, '11'], [2, 'Final report and presentation', 7, '12'],
      [2, 'Submission', 0, '13']
    ]
  },
  {
    id: 'sprint', name: 'Software sprint', desc: 'Two sprints of design, build and review, then a release',
    tasks: [
      [1, 'Sprint 1', 1], [2, 'Sprint planning', 1], [2, 'Design', 2, '2'], [2, 'Development', 5, '3'], [2, 'Code review and testing', 2, '4'],
      [2, 'Sprint review', 1, '5'],
      [1, 'Sprint 2', 1], [2, 'Sprint planning', 1, '6'], [2, 'Development', 6, '8'], [2, 'Code review and testing', 2, '9'], [2, 'Sprint review', 1, '10'],
      [1, 'Release', 1], [2, 'Release preparation', 2, '11'], [2, 'Deploy to production', 1, '13'], [2, 'Release', 0, '14']
    ]
  },
  {
    id: 'event', name: 'Event', desc: 'Venue, speakers, promotion, logistics and the day itself',
    tasks: [
      [1, 'Planning', 1], [2, 'Set goals and budget', 3], [2, 'Book venue', 5, '2'], [2, 'Confirm speakers or performers', 10, '2'],
      [1, 'Promotion', 1], [2, 'Design promotion materials', 5, '3'], [2, 'Open registration', 10, '6'],
      [1, 'Delivery', 1], [2, 'Arrange catering and equipment', 5, '3'], [2, 'Final run-through', 1, '4, 7, 9'], [2, 'Event day', 0, '10'],
      [2, 'Feedback survey and wrap-up', 3, '11']
    ]
  },
  {
    id: 'research', name: 'Research project', desc: 'Question, ethics, data collection, analysis and paper',
    tasks: [
      [1, 'Preparation', 1], [2, 'Define research question', 5], [2, 'Literature review', 15, '2'], [2, 'Ethics approval', 10, '2'],
      [1, 'Data collection', 1], [2, 'Design survey or instruments', 5, '3'], [2, 'Collect data', 20, '4, 6'],
      [1, 'Analysis and writing', 1], [2, 'Analyse data', 10, '7'], [2, 'Write paper', 15, '9'], [2, 'Submit paper', 0, '10']
    ]
  }
];

export function fromTemplate(t: Template): Project {
  let p = M.blank();
  p.name = t.name;
  t.tasks.forEach(([level, name, duration]) => p.tasks.push(M.newTask(p, { name, level, duration, milestone: duration === 0 })));
  t.tasks.forEach(([, , , preds], i) => { if (preds) p.tasks[i].preds = M.parsePreds(p, preds, p.tasks[i].uid).preds; });
  p = M.normalize(p);
  return p;
}
