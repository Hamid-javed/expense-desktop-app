import { connectToDatabase } from "../../lib/db";
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
  await connectToDatabase();

  const [staff, shops, products, orderTakers] = await Promise.all([
    Staff.find({ deletedAt: null, isActive: true }).sort({ name: 1 }).lean(),
    Shop.find({ deletedAt: null, isActive: true }).sort({ name: 1 }).lean(),
    Product.find({ deletedAt: null }).sort({ name: 1 }).lean(), // Show all non-deleted products for sales
    OrderTaker.find({ deletedAt: null, isActive: true }).sort({ name: 1 }).lean(),
  ]);

  // Serialize all ObjectIds to strings for client components (React requires plain objects)
  const serialisedProducts = products.map((p) => ({
    _id: p._id.toString(),
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    price: p.price,
    quantity: p.quantity ?? 0,
    isActive: p.isActive,
    totalSold: p.totalSold ?? 0,
    totalRevenue: p.totalRevenue ?? 0,
  }));

  const serialisedStaff = staff.map((s) => ({
    _id: s._id.toString(),
    name: s.name,
    phone: s.phone || "",
    staffId: s.staffId || "",
    routeId: s.routeId?.toString() || null,
    isActive: s.isActive,
  }));

  const serialisedShops = shops.map((s) => ({
    _id: s._id.toString(),
    name: s.name,
    ownerName: s.ownerName || "",
    phone: s.phone || "",
    currentCredit: s.currentCredit ?? 0,
    routeId: s.routeId?.toString() || null,
    isActive: s.isActive,
  }));

  const serialisedOrderTakers = orderTakers.map((ot) => ({
    _id: ot._id.toString(),
    name: ot.name,
    number: ot.number || "",
  }));

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

