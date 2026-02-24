/**
 * Populate references for SQLite models
 * Uses dynamic imports to avoid circular dependencies
 */
export async function populateReferences(data, fields) {
  if (!data) return data;

  if (Array.isArray(data)) {
    return Promise.all(data.map((item) => populateItem(item, fields)));
  }

  return populateItem(data, fields);
}

async function populateItem(item, fields) {
  if (!item) return item;

  // Handle multiple populate calls - fields can be string or array
  const fieldList = typeof fields === "string" ? [fields] : fields;
  if (!Array.isArray(fieldList)) return item;

  const result = { ...item };

  for (const field of fieldList) {
    if (field.includes(".")) {
      // Nested populate like "items.productId"
      const [parentField, childField] = field.split(".");
      if (Array.isArray(result[parentField])) {
        result[parentField] = await Promise.all(
          result[parentField].map(async (childItem) => {
            if (childItem && childItem[childField]) {
              const populated = await getReference(childField, childItem[childField]);
              return { ...childItem, [childField]: populated };
            }
            return childItem;
          })
        );
      }
    } else {
      // Simple populate
      if (result[field]) {
        const id = result[field]._id || result[field].id || result[field];
        if (id) {
          result[field] = await getReference(field, id);
        }
      }
    }
  }

  return result;
}

async function getReference(fieldName, id) {
  // Map field names to model imports (using dynamic imports to avoid circular deps)
  const modelMap = {
    shopId: () => import("./Shop.js").then((m) => m.Shop),
    salemanId: () => import("./Saleman.js").then((m) => m.Saleman),
    productId: () => import("./Product.js").then((m) => m.Product),
    routeId: () => import("./Route.js").then((m) => m.RouteModel),
    assignedSaleman: () => import("./Saleman.js").then((m) => m.Saleman),
    orderTakerId: () => import("./OrderTaker.js").then((m) => m.OrderTaker),
  };

  const modelLoader = modelMap[fieldName];
  if (!modelLoader) return null;

  // Handle both _id and id
  const actualId = id?._id || id?.id || id;
  if (!actualId) return null;

  const Model = await modelLoader();
  const queryWrapper = Model.findById(actualId);
  return await queryWrapper.execute();
}
