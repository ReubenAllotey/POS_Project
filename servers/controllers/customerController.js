import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from "../models/customerModel.js";

export async function getCustomersPage(req, res) {
  const customers = await listCustomers();

  return res.render("customers/customer", {
    title: "Customers",
    pageTitle: "Customers",
    customers,
  });
}

export async function listCustomersApi(req, res) {
  const customers = await listCustomers({ search: req.query.search });
  return res.json(customers);
}

export async function createCustomerApi(req, res) {
  try {
    const customer = await createCustomer(req.body);
    return res.status(201).json(customer);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function updateCustomerApi(req, res) {
  try {
    const customer = await updateCustomer(req.params.id, req.body);
    return res.json(customer);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function deleteCustomerApi(req, res) {
  try {
    await deleteCustomer(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
