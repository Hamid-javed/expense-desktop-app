import { connectToDatabase } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { serializeForClient } from "../../lib/serialize";
import { Product } from "../../models/Product";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import { ProductsTable } from "./ProductsTable";
import { createProduct, updateProduct, toggleProductActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const userId = await requireUserId();
  await connectToDatabase();
  const products = await Product.find(withUserId(userId, { deletedAt: null }))
    .sort({ createdAt: -1 })
    .lean();

  const serialised = serializeForClient(
    products.map((p) => ({ ...p, quantity: p.quantity ?? 0 }))
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description="Manage products, pricing, and high-level sales aggregates."
      />
      <Card>
        <CardBody>
          <ProductsTable
            products={serialised}
            createProduct={createProduct}
            updateProduct={updateProduct}
            toggleProductActive={toggleProductActive}
          />
        </CardBody>
      </Card>
    </div>
  );
}

