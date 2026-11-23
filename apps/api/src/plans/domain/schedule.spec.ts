import { describe, expect, it } from 'vitest';

import { InvalidScheduleError, parseSchedule } from './schedule.js';

const validSchedule = {
  days: [
    {
      date: '2026-11-28',
      stops: [
        {
          placeId: 'place-001',
          startAt: '2026-11-28T08:00:00+07:00',
          endAt: '2026-11-28T09:30:00+07:00',
          selectedItems: [
            {
              itemId: 'item-001',
              quantity: 2,
              memberIds: ['user-001', 'user-002'],
            },
          ],
        },
      ],
    },
  ],
};

describe('parseSchedule', () => {
  it('SCHEDULE-001: accepts a valid schedule', () => {
    expect(parseSchedule(validSchedule)).toEqual(validSchedule);
  });

  it('SCHEDULE-002: rejects a schedule without days', () => {
    expect(() => parseSchedule({ days: [] })).toThrow(InvalidScheduleError);
  });

  it('SCHEDULE-003: rejects an invalid calendar date', () => {
    const input = {
      days: [
        {
          ...validSchedule.days[0],
          date: '2026-02-30',
        },
      ],
    };

    expect(() => parseSchedule(input)).toThrow(InvalidScheduleError);
  });

  it('SCHEDULE-004: rejects a datetime without timezone', () => {
    const input = {
      days: [
        {
          ...validSchedule.days[0],
          stops: [
            {
              ...validSchedule.days[0].stops[0],
              startAt: '2026-11-28T08:00:00',
            },
          ],
        },
      ],
    };

    expect(() => parseSchedule(input)).toThrow(InvalidScheduleError);
  });

  it('SCHEDULE-005: rejects a stop whose end is not after its start', () => {
    const input = {
      days: [
        {
          ...validSchedule.days[0],
          stops: [
            {
              ...validSchedule.days[0].stops[0],
              endAt: '2026-11-28T08:00:00+07:00',
            },
          ],
        },
      ],
    };

    expect(() => parseSchedule(input)).toThrow(InvalidScheduleError);
  });

  it('SCHEDULE-006: rejects a non-positive quantity', () => {
    const input = {
      days: [
        {
          ...validSchedule.days[0],
          stops: [
            {
              ...validSchedule.days[0].stops[0],
              selectedItems: [
                {
                  ...validSchedule.days[0].stops[0].selectedItems[0],
                  quantity: 0,
                },
              ],
            },
          ],
        },
      ],
    };

    expect(() => parseSchedule(input)).toThrow(InvalidScheduleError);
  });

  it('SCHEDULE-007: rejects duplicate member IDs', () => {
    const input = {
      days: [
        {
          ...validSchedule.days[0],
          stops: [
            {
              ...validSchedule.days[0].stops[0],
              selectedItems: [
                {
                  ...validSchedule.days[0].stops[0].selectedItems[0],
                  memberIds: ['user-001', 'user-001'],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(() => parseSchedule(input)).toThrow(InvalidScheduleError);
  });

  it('SCHEDULE-008: rejects an empty member assignment', () => {
    const input = {
      days: [
        {
          ...validSchedule.days[0],
          stops: [
            {
              ...validSchedule.days[0].stops[0],
              selectedItems: [
                {
                  ...validSchedule.days[0].stops[0].selectedItems[0],
                  memberIds: [],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(() => parseSchedule(input)).toThrow(InvalidScheduleError);
  });
});
