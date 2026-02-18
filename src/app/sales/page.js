import { connectToDatabase } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { serializeForClient } from "../../lib/serialize";
import { Staff } from "../../models/Staff";
import { Shop } from "../../models/Shop";
import { Product } from "../../models/Product";
import { OrderTaker } from "../../models/OrderTaker";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/Table";
import { SalesForm } from "./SalesForm";
import { createSale } from "./actions";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  const [staff, shops, products, orderTakers] = await Promise.all([
    Staff.find(withUserId(userId, { deletedAt: null, isActive: true })).sort({ name: 1 }).lean(),
    Shop.find(withUserId(userId, { deletedAt: null, isActive: true })).sort({ name: 1 }).lean(),
    Product.find(withUserId(userId, { deletedAt: null })).sort({ name: 1 }).lean(),
    OrderTaker.find(withUserId(userId, { deletedAt: null, isActive: true })).sort({ name: 1 }).lean(),
  ]);

  const serialisedProducts = serializeForClient(
    products.map((p) => ({ ...p, quantity: p.quantity ?? 0 }))
  );
  const serialisedStaff = serializeForClient(staff);
  const serialisedShops = serializeForClient(shops);
  const serialisedOrderTakers = serializeForClient(orderTakers);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales / Distribution"
        description="Daily sales entry per staff with inline product rows."
      />

      <Card>
        <CardBody>
          <SalesForm
            staff={serialisedStaff}
            shops={serialisedShops}
            products={serialisedProducts}
            orderTakers={serialisedOrderTakers}
            createSale={createSale}
          />
        </CardBody>
      </Card>

    </div>
  );
}

