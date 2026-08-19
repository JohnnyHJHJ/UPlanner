/* UPlanner tour fix
 * Keeps the existing onboarding tour for users who still need a schedule,
 * but suppresses it once the current user already has scheduled classes.
 */
(function () {
  'use strict';

  function hasOwnScheduleEntries() {
    var session = window.getSession && window.getSession();
    if (!session || !window.getUserSchedules || !window.getScheduleEntries) return false;

    var schedules = window.getUserSchedules(session.userId) || [];
    return schedules.some(function (schedule) {
      return (window.getScheduleEntries(schedule.schedule_id) || []).length > 0;
    });
  }

  function suppressTour