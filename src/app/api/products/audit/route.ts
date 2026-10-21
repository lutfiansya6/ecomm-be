// GET /api/products/audit — audit products matching price pattern price % 10000 === 1000
import { db } from '@/lib/store';
import { successResponse } from '@/lib/utils';

export async function GET() {
  const all = db.products.findAll();
  const audited = all
    .filter((p) => {
      const priceMatch = p.price % 10000 === 1000;
      const compareMatch = Boolean(p.comparePrice && p.comparePrice % 10000 === 1000);
      return priceMatch || compareMatch;
    })
    .map((p) => {
      const priceMatch = p.price % 10000 === 1000;
      const compareMatch = Boolean(p.comparePrice && p.comparePrice % 10000 === 1000);
      const matchedFields: string[] = [];
      if (priceMatch) matchedFields.push('price');
      if (compareMatch) matchedFields.push('comparePrice');

      return {
        id: p.id,
        name: p.name,
        price: p.price,
        comparePrice: p.comparePrice ?? null,
        priceMatches: priceMatch,
        comparePriceMatches: compareMatch,
        matchedFields,
      };
    });

  return successResponse({
    totalMatches: audited.length,
    products: audited,
  });
}
