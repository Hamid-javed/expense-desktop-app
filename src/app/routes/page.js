import { connectToDatabase } from "../../lib/db";
import { requireUserId } from "../../lib/auth";
import { withUserId } from "../../lib/tenant";
import { serializeForClient } from "../../lib/serialize";
import { RouteModel } from "../../models/Route";
import { Staff } from "../../models/Staff";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import { Table, THead, TBody, TR, TH } from "../../components/ui/Table";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { createRoute, assignStaffToRoute, updateRoute, deleteRoute } from "./actions";
import { RouteRow } from "./RouteRow";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const userId = await requireUserId();
  await connectToDatabase();
  const [routesRaw, staffRaw, allStaffRaw] = await Promise.all([
    RouteModel.find(withUserId(userId, { deletedAt: null })).sort({ name: 1 }).lean(),
    Staff.find(withUserId(userId, { deletedAt: null, isActive: true })).sort({ name: 1 }).lean(),
    Staff.find(withUserId(userId, { deletedAt: null })).sort({ name: 1 }).lean(),
  ]);
  const routes = serializeForClient(routesRaw);
  const staff = serializeForClient(staffRaw);
  const allStaff = serializeForClient(allStaffRaw);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Routes"
        description="Manage sales routes and assign staff."
      />
      <Card>
        <CardBody>
          <form
            action={createRoute}
            className="mb-4 flex flex-wrap gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs md:text-sm"
          >
            <Input
              label="Route name"
              name="name"
              required
              className="w-48"
              placeholder="e.g. Downtown"
            />
            <div className="flex items-end">
              <Button type="submit">Add Route</Button>
            </div>
          </form>

          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Assigned Staff</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {routes.map((r) => {
                const assigned = allStaff.find((s) => s._id === r.assignedStaff);
                return (
                  <RouteRow
                    key={r._id}
                    route={r}
                    assignedStaff={assigned}
                    staff={staff}
                    assignStaffToRoute={assignStaffToRoute}
                    updateRoute={updateRoute}
                    deleteRoute={deleteRoute}
                  />
                );
              })}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

