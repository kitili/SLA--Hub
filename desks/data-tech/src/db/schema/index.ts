import { relations } from "drizzle-orm";
import { users } from "./users";
import { departments } from "./departments";
import { tickets } from "./tickets";
import { ticketAssignees } from "./ticket-assignees";
import { ticketSolutions } from "./ticket-solutions";
import { ticketStatusHistory } from "./ticket-status-history";
import { ticketAttachments } from "./ticket-attachments";
import { tools } from "./tools";
import { toolCategories } from "./tool-categories";
import { toolLocations } from "./tool-locations";
import { toolConditions } from "./tool-conditions";
import { toolAllocations } from "./tool-allocations";
import { systems } from "./systems";
import { systemPhases } from "./system-phases";
import { systemSprints } from "./system-sprints";
import { sprintCapacities } from "./sprint-capacities";
import { systemTasks } from "./system-tasks";
import {
  systemTaskActivity,
  systemTaskAssignees,
  systemTaskAttachments,
  systemTaskChecklistItems,
  systemTaskChecklists,
  systemTaskComments,
  systemTaskDependencies,
  systemTaskTagLinks,
  systemTaskTags,
  systemTaskTimeEntries,
  systemTaskWatchers,
} from "./system-task-workspace";
import { userModules } from "./user-modules";
import { subscriptions } from "./subscriptions";
import { subscriptionDepartments } from "./subscription-departments";
import { subscriptionNotifyRecipients } from "./subscription-notify-recipients";
import { toolReminderDates } from "./tool-reminder-dates";
import {
  oneToFives,
  oneToFiveHolidays,
  oneToFiveExtraDays,
  pulseChecks,
  oneToFiveFeedback,
} from "./one-to-fives";

export * from "./users";
export * from "./departments";
export * from "./password-reset-tokens";
export * from "./login-otp-codes";
export * from "./tickets";
export * from "./ticket-attachments";
export * from "./ticket-assignees";
export * from "./ticket-solutions";
export * from "./ticket-status-history";
export * from "./tool-categories";
export * from "./tool-locations";
export * from "./tools";
export * from "./tool-conditions";
export * from "./tool-allocations";
export * from "./support-contacts";
export * from "./audit-logs";
export * from "./rate-limit-events";
export * from "./ticket-notify-recipients";
export * from "./systems";
export * from "./system-phases";
export * from "./system-sprints";
export * from "./sprint-capacities";
export * from "./system-tasks";
export * from "./system-task-workspace";
export * from "./clickup-settings";
export * from "./user-modules";
export * from "./subscriptions";
export * from "./subscription-departments";
export * from "./subscription-notify-recipients";
export * from "./subscription-reminders-sent";
export * from "./tool-reminder-dates";
export * from "./tool-reminders-sent";
export * from "./one-to-fives";

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, { fields: [users.departmentId], references: [departments.id] }),
  ticketAssignments: many(ticketAssignees),
  moduleAccess: many(userModules),
  oneToFives: many(oneToFives),
}));

export const userModulesRelations = relations(userModules, ({ one }) => ({
  user: one(users, { fields: [userModules.userId], references: [users.id] }),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  tickets: many(tickets),
  subscriptionLinks: many(subscriptionDepartments),
  pulseChecks: many(pulseChecks),
  systems: many(systems),
}));

export const subscriptionsRelations = relations(subscriptions, ({ many }) => ({
  departmentLinks: many(subscriptionDepartments),
  notifyRecipients: many(subscriptionNotifyRecipients),
}));

export const subscriptionDepartmentsRelations = relations(subscriptionDepartments, ({ one }) => ({
  subscription: one(subscriptions, { fields: [subscriptionDepartments.subscriptionId], references: [subscriptions.id] }),
  department: one(departments, { fields: [subscriptionDepartments.departmentId], references: [departments.id] }),
}));

export const subscriptionNotifyRecipientsRelations = relations(subscriptionNotifyRecipients, ({ one }) => ({
  subscription: one(subscriptions, { fields: [subscriptionNotifyRecipients.subscriptionId], references: [subscriptions.id] }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  department: one(departments, { fields: [tickets.departmentId], references: [departments.id] }),
  tool: one(tools, { fields: [tickets.toolId], references: [tools.id] }),
  linkedTask: one(systemTasks, { fields: [tickets.linkedTaskId], references: [systemTasks.id] }),
  assignees: many(ticketAssignees),
  solutions: many(ticketSolutions),
  statusHistory: many(ticketStatusHistory),
  attachments: many(ticketAttachments),
}));

export const ticketAssigneesRelations = relations(ticketAssignees, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketAssignees.ticketId], references: [tickets.id] }),
  user: one(users, { fields: [ticketAssignees.userId], references: [users.id] }),
}));

export const ticketSolutionsRelations = relations(ticketSolutions, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketSolutions.ticketId], references: [tickets.id] }),
  author: one(users, { fields: [ticketSolutions.authorId], references: [users.id] }),
}));

export const ticketStatusHistoryRelations = relations(ticketStatusHistory, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketStatusHistory.ticketId], references: [tickets.id] }),
  changedByUser: one(users, { fields: [ticketStatusHistory.changedBy], references: [users.id] }),
}));

export const ticketAttachmentsRelations = relations(ticketAttachments, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketAttachments.ticketId], references: [tickets.id] }),
}));

export const toolsRelations = relations(tools, ({ one, many }) => ({
  category: one(toolCategories, { fields: [tools.categoryId], references: [toolCategories.id] }),
  location: one(toolLocations, { fields: [tools.locationId], references: [toolLocations.id] }),
  conditions: many(toolConditions),
  allocations: many(toolAllocations),
  reminderDates: many(toolReminderDates),
  relatedTickets: many(tickets),
}));

export const toolReminderDatesRelations = relations(toolReminderDates, ({ one }) => ({
  tool: one(tools, { fields: [toolReminderDates.toolId], references: [tools.id] }),
}));

export const toolConditionsRelations = relations(toolConditions, ({ one }) => ({
  tool: one(tools, { fields: [toolConditions.toolId], references: [tools.id] }),
  recordedByUser: one(users, { fields: [toolConditions.recordedBy], references: [users.id] }),
}));

export const toolAllocationsRelations = relations(toolAllocations, ({ one }) => ({
  tool: one(tools, { fields: [toolAllocations.toolId], references: [tools.id] }),
  allocatedToUser: one(users, { fields: [toolAllocations.allocatedToUserId], references: [users.id] }),
  allocatedToDepartment: one(departments, {
    fields: [toolAllocations.allocatedToDepartmentId],
    references: [departments.id],
  }),
  allocatedToLocation: one(toolLocations, {
    fields: [toolAllocations.allocatedToLocationId],
    references: [toolLocations.id],
  }),
}));

export const systemsRelations = relations(systems, ({ one, many }) => ({
  tasks: many(systemTasks),
  phases: many(systemPhases),
  sprints: many(systemSprints),
  lead: one(users, { fields: [systems.leadId], references: [users.id] }),
  department: one(departments, { fields: [systems.departmentId], references: [departments.id] }),
}));

export const systemPhasesRelations = relations(systemPhases, ({ one, many }) => ({
  system: one(systems, { fields: [systemPhases.systemId], references: [systems.id] }),
  sprints: many(systemSprints),
  tasks: many(systemTasks),
}));

export const systemSprintsRelations = relations(systemSprints, ({ one, many }) => ({
  system: one(systems, { fields: [systemSprints.systemId], references: [systems.id] }),
  phase: one(systemPhases, { fields: [systemSprints.phaseId], references: [systemPhases.id] }),
  tasks: many(systemTasks),
  capacities: many(sprintCapacities),
}));

export const sprintCapacitiesRelations = relations(sprintCapacities, ({ one }) => ({
  sprint: one(systemSprints, { fields: [sprintCapacities.sprintId], references: [systemSprints.id] }),
  user: one(users, { fields: [sprintCapacities.userId], references: [users.id] }),
}));

export const systemTasksRelations = relations(systemTasks, ({ one, many }) => ({
  system: one(systems, { fields: [systemTasks.systemId], references: [systems.id] }),
  phase: one(systemPhases, { fields: [systemTasks.phaseId], references: [systemPhases.id] }),
  sprint: one(systemSprints, { fields: [systemTasks.sprintId], references: [systemSprints.id] }),
  assignee: one(users, { fields: [systemTasks.assigneeId], references: [users.id] }),
  createdByUser: one(users, { fields: [systemTasks.createdBy], references: [users.id] }),
  parent: one(systemTasks, {
    fields: [systemTasks.parentTaskId],
    references: [systemTasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(systemTasks, { relationName: "subtasks" }),
  assignees: many(systemTaskAssignees),
  watchers: many(systemTaskWatchers),
  tagLinks: many(systemTaskTagLinks),
  comments: many(systemTaskComments),
  checklists: many(systemTaskChecklists),
  dependencies: many(systemTaskDependencies, { relationName: "taskDepends" }),
  dependents: many(systemTaskDependencies, { relationName: "taskBlocks" }),
  attachments: many(systemTaskAttachments),
  timeEntries: many(systemTaskTimeEntries),
  activity: many(systemTaskActivity),
}));

export const systemTaskAssigneesRelations = relations(systemTaskAssignees, ({ one }) => ({
  task: one(systemTasks, { fields: [systemTaskAssignees.taskId], references: [systemTasks.id] }),
  user: one(users, { fields: [systemTaskAssignees.userId], references: [users.id] }),
}));

export const systemTaskWatchersRelations = relations(systemTaskWatchers, ({ one }) => ({
  task: one(systemTasks, { fields: [systemTaskWatchers.taskId], references: [systemTasks.id] }),
  user: one(users, { fields: [systemTaskWatchers.userId], references: [users.id] }),
}));

export const systemTaskTagsRelations = relations(systemTaskTags, ({ one, many }) => ({
  system: one(systems, { fields: [systemTaskTags.systemId], references: [systems.id] }),
  links: many(systemTaskTagLinks),
}));

export const systemTaskTagLinksRelations = relations(systemTaskTagLinks, ({ one }) => ({
  task: one(systemTasks, { fields: [systemTaskTagLinks.taskId], references: [systemTasks.id] }),
  tag: one(systemTaskTags, { fields: [systemTaskTagLinks.tagId], references: [systemTaskTags.id] }),
}));

export const systemTaskCommentsRelations = relations(systemTaskComments, ({ one }) => ({
  task: one(systemTasks, { fields: [systemTaskComments.taskId], references: [systemTasks.id] }),
  author: one(users, { fields: [systemTaskComments.authorId], references: [users.id] }),
}));

export const systemTaskChecklistsRelations = relations(systemTaskChecklists, ({ one, many }) => ({
  task: one(systemTasks, { fields: [systemTaskChecklists.taskId], references: [systemTasks.id] }),
  items: many(systemTaskChecklistItems),
}));

export const systemTaskChecklistItemsRelations = relations(systemTaskChecklistItems, ({ one }) => ({
  checklist: one(systemTaskChecklists, {
    fields: [systemTaskChecklistItems.checklistId],
    references: [systemTaskChecklists.id],
  }),
  assignee: one(users, { fields: [systemTaskChecklistItems.assigneeId], references: [users.id] }),
}));

export const systemTaskDependenciesRelations = relations(systemTaskDependencies, ({ one }) => ({
  task: one(systemTasks, {
    fields: [systemTaskDependencies.taskId],
    references: [systemTasks.id],
    relationName: "taskDepends",
  }),
  dependsOn: one(systemTasks, {
    fields: [systemTaskDependencies.dependsOnTaskId],
    references: [systemTasks.id],
    relationName: "taskBlocks",
  }),
}));

export const systemTaskAttachmentsRelations = relations(systemTaskAttachments, ({ one }) => ({
  task: one(systemTasks, { fields: [systemTaskAttachments.taskId], references: [systemTasks.id] }),
}));

export const systemTaskTimeEntriesRelations = relations(systemTaskTimeEntries, ({ one }) => ({
  task: one(systemTasks, { fields: [systemTaskTimeEntries.taskId], references: [systemTasks.id] }),
  user: one(users, { fields: [systemTaskTimeEntries.userId], references: [users.id] }),
}));

export const systemTaskActivityRelations = relations(systemTaskActivity, ({ one }) => ({
  task: one(systemTasks, { fields: [systemTaskActivity.taskId], references: [systemTasks.id] }),
  actor: one(users, { fields: [systemTaskActivity.actorId], references: [users.id] }),
}));

export const oneToFivesRelations = relations(oneToFives, ({ one, many }) => ({
  user: one(users, { fields: [oneToFives.userId], references: [users.id] }),
  feedback: many(oneToFiveFeedback),
}));

export const oneToFiveFeedbackRelations = relations(oneToFiveFeedback, ({ one }) => ({
  entry: one(oneToFives, { fields: [oneToFiveFeedback.oneToFiveId], references: [oneToFives.id] }),
  author: one(users, { fields: [oneToFiveFeedback.authorId], references: [users.id] }),
}));

export const pulseChecksRelations = relations(pulseChecks, ({ one }) => ({
  department: one(departments, { fields: [pulseChecks.departmentId], references: [departments.id] }),
  submitter: one(users, { fields: [pulseChecks.submittedBy], references: [users.id] }),
}));
