import type { PricedScheduleItem } from '../../domain/budget-calculator.js';
import type {
  PricedItemProvider,
  PricedItemReference,
} from '../../domain/priced-item-provider.js';
import { InMemoryStore } from './in-memory.store.js';

export class InMemoryPricedItemProvider implements PricedItemProvider {
  constructor(private readonly store: InMemoryStore) {}

  async findPrices(
    items: readonly PricedItemReference[],
  ): Promise<PricedScheduleItem[]> {
    const prices: PricedScheduleItem[] = [];

    for (const item of items) {
      const key = JSON.stringify([item.placeId, item.itemId]);
      const price = this.store.itemPrices.get(key);

      if (price) {
        prices.push(price);
      }
    }

    return prices;
  }
}
