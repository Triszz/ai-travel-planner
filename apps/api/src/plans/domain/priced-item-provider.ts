import type { PricedScheduleItem } from './budget-calculator.js';

export type PricedItemReference = Pick<
  PricedScheduleItem,
  'placeId' | 'itemId'
>;

export interface PricedItemProvider {
  findPrices(
    items: readonly PricedItemReference[],
  ): Promise<PricedScheduleItem[]>;
}

export const PRICED_ITEM_PROVIDER = Symbol('PRICED_ITEM_PROVIDER');
