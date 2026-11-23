export interface Schedule {
  days: ScheduleDay[];
}

export interface ScheduleDay {
  date: string;
  stops: ScheduleStop[];
}

export interface ScheduleStop {
  placeId: string;
  startAt: string;
  endAt: string;
  selectedItems: SelectedScheduleItem[];
}

export interface SelectedScheduleItem {
  itemId: string;
  quantity: number;
  memberIds: string[];
}

export interface ScheduleIssue {
  path: string;
  message: string;
}

export class InvalidScheduleError extends Error {
  constructor(public readonly issues: ScheduleIssue[]) {
    super('Schedule does not match the required structure.');
    this.name = 'InvalidScheduleError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isValidDateTime(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}

export function parseSchedule(value: unknown): Schedule {
  const issues: ScheduleIssue[] = [];

  if (!isRecord(value) || !Array.isArray(value.days)) {
    throw new InvalidScheduleError([
      {
        path: 'days',
        message: 'Schedule must contain a days array.',
      },
    ]);
  }

  if (value.days.length === 0) {
    issues.push({
      path: 'days',
      message: 'Schedule must contain at least one day.',
    });
  }

  const days: ScheduleDay[] = [];

  value.days.forEach((rawDay, dayIndex) => {
    const dayPath = `days[${dayIndex}]`;

    if (!isRecord(rawDay)) {
      issues.push({
        path: dayPath,
        message: 'Day must be an object.',
      });
      return;
    }

    const date = rawDay.date;

    if (typeof date !== 'string' || !isValidDate(date)) {
      issues.push({
        path: `${dayPath}.date`,
        message: 'Date must be a valid YYYY-MM-DD date.',
      });
    }

    if (!Array.isArray(rawDay.stops) || rawDay.stops.length === 0) {
      issues.push({
        path: `${dayPath}.stops`,
        message: 'Day must contain at least one stop.',
      });
      return;
    }

    const stops: ScheduleStop[] = [];

    rawDay.stops.forEach((rawStop, stopIndex) => {
      const stopPath = `${dayPath}.stops[${stopIndex}]`;

      if (!isRecord(rawStop)) {
        issues.push({
          path: stopPath,
          message: 'Stop must be an object.',
        });
        return;
      }

      const { placeId, startAt, endAt, selectedItems } = rawStop;

      if (typeof placeId !== 'string' || placeId.trim() === '') {
        issues.push({
          path: `${stopPath}.placeId`,
          message: 'placeId must be a non-empty string.',
        });
      }

      if (typeof startAt !== 'string' || !isValidDateTime(startAt)) {
        issues.push({
          path: `${stopPath}.startAt`,
          message: 'startAt must be an ISO 8601 datetime with timezone.',
        });
      }

      if (typeof endAt !== 'string' || !isValidDateTime(endAt)) {
        issues.push({
          path: `${stopPath}.endAt`,
          message: 'endAt must be an ISO 8601 datetime with timezone.',
        });
      }

      if (
        typeof startAt === 'string' &&
        typeof endAt === 'string' &&
        isValidDateTime(startAt) &&
        isValidDateTime(endAt) &&
        Date.parse(endAt) <= Date.parse(startAt)
      ) {
        issues.push({
          path: `${stopPath}.endAt`,
          message: 'endAt must be later than startAt.',
        });
      }

      if (!Array.isArray(selectedItems)) {
        issues.push({
          path: `${stopPath}.selectedItems`,
          message: 'selectedItems must be an array.',
        });
        return;
      }

      const parsedItems: SelectedScheduleItem[] = [];

      selectedItems.forEach((rawItem, itemIndex) => {
        const itemPath = `${stopPath}.selectedItems[${itemIndex}]`;

        if (!isRecord(rawItem)) {
          issues.push({
            path: itemPath,
            message: 'Selected item must be an object.',
          });
          return;
        }

        const { itemId, quantity, memberIds } = rawItem;

        if (typeof itemId !== 'string' || itemId.trim() === '') {
          issues.push({
            path: `${itemPath}.itemId`,
            message: 'itemId must be a non-empty string.',
          });
        }

        if (
          typeof quantity !== 'number' ||
          !Number.isSafeInteger(quantity) ||
          quantity <= 0
        ) {
          issues.push({
            path: `${itemPath}.quantity`,
            message: 'quantity must be a positive safe integer.',
          });
        }

        if (
          !Array.isArray(memberIds) ||
          memberIds.length === 0 ||
          !memberIds.every((id) => typeof id === 'string' && id.trim() !== '')
        ) {
          issues.push({
            path: `${itemPath}.memberIds`,
            message: 'memberIds must contain at least one valid member ID.',
          });
        } else if (new Set(memberIds).size !== memberIds.length) {
          issues.push({
            path: `${itemPath}.memberIds`,
            message: 'memberIds must not contain duplicates.',
          });
        }

        if (
          typeof itemId === 'string' &&
          itemId.trim() !== '' &&
          typeof quantity === 'number' &&
          Number.isSafeInteger(quantity) &&
          quantity > 0 &&
          Array.isArray(memberIds) &&
          memberIds.length > 0 &&
          memberIds.every((id) => typeof id === 'string' && id.trim() !== '') &&
          new Set(memberIds).size === memberIds.length
        ) {
          parsedItems.push({
            itemId,
            quantity,
            memberIds: [...memberIds],
          });
        }
      });

      if (
        typeof placeId === 'string' &&
        placeId.trim() !== '' &&
        typeof startAt === 'string' &&
        isValidDateTime(startAt) &&
        typeof endAt === 'string' &&
        isValidDateTime(endAt) &&
        Date.parse(endAt) > Date.parse(startAt)
      ) {
        stops.push({
          placeId,
          startAt,
          endAt,
          selectedItems: parsedItems,
        });
      }
    });

    if (typeof date === 'string' && isValidDate(date)) {
      days.push({ date, stops });
    }
  });

  if (issues.length > 0) {
    throw new InvalidScheduleError(issues);
  }

  return { days };
}
