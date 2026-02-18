import { connectToDatabase } from "../../lib/db";
import { OrderTaker } from "../../models/OrderTaker";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import { Table, THead, TBody, TR, TH } from "../../components/ui/Table";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import {
  createOrderTaker,
  updateOrderTaker,
  deleteOrderTaker,
} from "./actions";
import { OrderTakerRow } from "./OrderTakerRow";
import { DownloadUnpaidInvoicesButton } from "./DownloadUnpaidInvoicesButton";

export const dynamic = "force-dynamic";

export default async function OrderTakersPage() {
  await connectToDatabase();
  const orderTakersRaw = await OrderTaker.find({ deletedAt: null })
    .sort({ name: 1 })
    .lean();

  const orderTakers = orderTakersRaw.map((ot) => ({
    ...ot,
    _id: ot._id.toString(),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Order Takers (OT)"
        description="Manage order takers. Name and number are required; CNIC is optional."
        actions={<DownloadUnpaidInvoicesButton />}
      />
      <Card>
        <CardBody>
          <form
            action={createOrderTaker}
            className="mb-4 flex flex-wrap gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs md:text-sm"
          >
            <Input
              label="Name"
              name="name"
              required
              className="w-48"
              placeholder="Order taker name"
            />
            <Input
              label="Number"
              name="number"
              required
              className="w-40"
              placeholder="Phone / number"
            />
            <Input
              label="CNIC (optional)"
              name="cnic"
              className="w-44"
              placeholder="CNIC"
            />
            <div className="flex items-end">
              <Button type="submit">Add Order Taker</Button>
            </div>
          </form>

          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Number</TH>
                <TH>CNIC</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {orderTakers.map((ot) => (
                <OrderTakerRow
                  key={ot._id}
                  orderTaker={ot}
                  updateOrderTaker={updateOrderTaker}
                  deleteOrderTaker={deleteOrderTaker}
                />
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
