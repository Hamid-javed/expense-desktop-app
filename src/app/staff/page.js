import { connectToDatabase } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { serializeForClient } from "../../lib/serialize";
import { Staff } from "../../models/Staff";
import { RouteModel } from "../../models/Route";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/Table";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import Link from "next/link";
import { createStaff, updateStaff, toggleStaffActive } from "./actions";
import { StaffRow } from "./StaffRow";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const userId = await requireUserId();
  await connectToDatabase();
  const [staffRaw, routesRaw] = await Promise.all([
    Staff.find(withUserId(userId, { deletedAt: null })).sort({ createdAt: -1 }).lean(),
    RouteModel.find(withUserId(userId, { deletedAt: null })).sort({ name: 1 }).lean(),
  ]);

  const staff = serializeForClient(staffRaw);
  const routes = serializeForClient(routesRaw);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        description="Manage sales staff, routes, and their status."
      />
      <Card>
        <CardBody>
          <form
            action={createStaff}
            className="mb-4 flex flex-wrap gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs md:text-sm"
          >
            <Input
              label="Name"
              name="name"
              required
              className="w-40 md:w-48"
              placeholder="Staff name"
            />
            <Input
              label="Phone"
              name="phone"
              className="w-40 md:w-48"
              placeholder="Optional"
            />
            <Input
              label="CNIC"
              name="cnic"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-36"
              placeholder="e.g. 3130302876477"
            />
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Route</span>
              <select
                name="routeId"
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              >
                <option value="">Unassigned</option>
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit">Add Staff</Button>
            </div>
          </form>

          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Phone</TH>
                <TH>CNIC</TH>
                <TH>Staff ID</TH>
                <TH>Route</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {staff.map((s) => (
                <StaffRow
                  key={s._id}
                  staff={s}
                  routes={routes}
                  updateStaff={updateStaff}
                  toggleStaffActive={toggleStaffActive}
                />
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

