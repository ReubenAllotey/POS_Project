import {
  checkPendingCharge,
  createPaystackCharge,
  getPaystackCallbackUrl,
  initializePaystackTransaction,
  isPaystackConfigured,
  submitPaystackOtp,
  submitPaystackPhone,
  submitPaystackPin,
  validatePaystackRuntime,
  verifyPaystackTransaction,
} from "../../config/paystack.js";
import { getCustomerById, listCustomers } from "../models/customerModel.js";
import { listProducts } from "../models/productModel.js";
import {
  createSale,
  getSaleById,
  getSaleByPaystackReference,
  previewSale,
} from "../models/salesModel.js";
import { findUserById } from "../models/userModel.js";
import {
  createPendingPayment,
  getPendingPaymentByReference,
  markPendingPaymentCompleted,
  markPendingPaymentFailed,
  updatePendingPaymentState,
  updatePendingPaymentInitialization,
} from "../models/pendingPaymentModel.js";
import { buildReceiptViewModel } from "../utils/receiptGenerator.js";

function generatePaystackReference() {
  return `POS-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function buildWalkInEmail(phone, reference) {
  const digits = String(phone || "").replace(/\D/g, "") || reference.toLowerCase();
  return `walkin.${digits}@easysales.local`;
}

function normalizeGhanaPhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length >= 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `233${digits.slice(1)}`;
  }

  return digits;
}

function normalizeMomoProvider(provider) {
  const normalized = String(provider || "mtn").trim().toLowerCase();
  const providerMap = {
    mtn: "mtn",
    vod: "vod",
    telecel: "vod",
    tgo: "atl",
    airteltigo: "atl",
    atl: "atl",
  };

  return providerMap[normalized] || "mtn";
}

function buildPaystackActionResponse(data) {
  const status = String(data?.status || "").toLowerCase();
  const displayText = data?.display_text || data?.gateway_response || "";
  const reference = data?.reference || "";

  if (
    reference &&
    ["pay_offline", "open_url", "pending"].includes(status)
  ) {
    return {
      status: "pending",
      displayText:
        displayText ||
        "Please complete the authorization process on the customer's phone.",
      reference,
    };
  }

  return {
    status,
    displayText,
    reference,
  };
}

function isPinAuthorizationMessage(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    (normalized.includes("pin") && (
      normalized.includes("mobile device") ||
      normalized.includes("mobile money") ||
      normalized.includes("authorisation process") ||
      normalized.includes("authorization process")
    )) ||
    normalized.includes("please complete the authorisation process") ||
    normalized.includes("please complete the authorization process") ||
    normalized.includes("inputting your pin") ||
    normalized.includes("your pin on your mobile device")
  );
}

function extractPaystackReference(errorPayload, fallbackReference = "") {
  return errorPayload?.data?.reference || errorPayload?.reference || fallbackReference || "";
}

async function finalizeVerifiedPayment(reference, pendingPayment) {
  const existingSale = await getSaleByPaystackReference(reference);
  if (existingSale) {
    return existingSale;
  }

  const verification = await verifyPaystackTransaction(reference);
  if (verification.status !== "success") {
    throw new Error(verification.gateway_response || "Payment is not yet successful.");
  }

  const sale = await createSale({
    items: pendingPayment.payload.items,
    customerId: pendingPayment.payload.customerId,
    cashierId: pendingPayment.payload.cashierId,
    paymentMethod: pendingPayment.paymentMethod,
    amountPaid: Number(verification.amount) / 100,
    discountAmount: pendingPayment.payload.discountAmount,
    paystackReference: reference,
    paystackTransactionId: verification.id,
  });

  await markPendingPaymentCompleted(reference, {
    saleId: sale.id,
    transactionId: verification.id,
  });

  return sale;
}

async function tryFinalizeIfVerified(reference, pendingPayment) {
  try {
    const sale = await finalizeVerifiedPayment(reference, pendingPayment);
    return sale;
  } catch (error) {
    const message = String(error.message || "");
    if (message.includes("Payment is not yet successful")) {
      return null;
    }

    throw error;
  }
}

async function respondToChargeStep({ res, pendingPayment, chargeData }) {
  const action = buildPaystackActionResponse(chargeData);
  const lastChargeStatus = pendingPayment.payload?.lastChargeStatus || "";

  if (["send_otp", "send_pin", "send_phone"].includes(action.status)) {
    await updatePendingPaymentState(pendingPayment.reference, {
      status: "initiated",
      paystackTransactionId: chargeData.id ? String(chargeData.id) : null,
      payload: {
        ...pendingPayment.payload,
        lastChargeStatus: action.status,
      },
    });

    return res.json({
      nextAction: action.status,
      message: action.displayText,
      reference: action.reference,
    });
  }

  if (action.status === "pending") {
    const pendingMessage =
      lastChargeStatus === "send_pin"
        ? "PIN submitted. Waiting for payment confirmation from the mobile money provider."
        : action.displayText || "Waiting for customer authorization.";

    await updatePendingPaymentState(pendingPayment.reference, {
      status: "initiated",
      paystackTransactionId: chargeData.id ? String(chargeData.id) : null,
      payload: {
        ...pendingPayment.payload,
        lastChargeStatus: action.status,
      },
    });

    return res.json({
      nextAction: "pending",
      message: pendingMessage,
      reference: action.reference,
    });
  }

  if (action.status === "success") {
    const sale = await finalizeVerifiedPayment(pendingPayment.reference, pendingPayment);
    return res.json({
      nextAction: "success",
      redirectUrl: `/receipts/${sale.id}`,
      reference: pendingPayment.reference,
    });
  }

  await markPendingPaymentFailed(pendingPayment.reference);
  return res.status(400).json({
    error: action.displayText || "Mobile money authorization failed.",
  });
}

export async function getPosPage(req, res) {
  const [products, customers] = await Promise.all([listProducts(), listCustomers()]);

  return res.render("pos/pos", {
    title: "Point Of Sale",
    pageTitle: "Point Of Sale",
    products,
    customers,
  });
}

export async function getMomoPage(req, res) {
  return res.render("pos/momo", {
    title: "Mobile Money Checkout",
    pageTitle: "Mobile Money Checkout",
  });
}

export async function getMomoAuthorizePage(req, res) {
  return res.render("pos/momo-auth", {
    title: "Mobile Money Authorization",
    pageTitle: "Mobile Money Authorization",
  });
}

export async function createSaleApi(req, res) {
  try {
    const sale = await createSale({
      items: req.body.items,
      customerId: req.body.customerId,
      cashierId: req.user?.id,
      paymentMethod: req.body.paymentMethod,
      amountPaid: req.body.amountPaid,
      discountAmount: req.body.discountAmount,
    });

    return res.status(201).json({
      sale,
      redirectUrl: `/receipts/${sale.id}`,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function initializePaystackPaymentApi(req, res) {
  let reference = "";
  try {
    if (!isPaystackConfigured()) {
      return res.status(500).json({
        error: "PAYSTACK_SECRET_KEY is not configured on the server.",
      });
    }

    validatePaystackRuntime();

    const paymentMethod = String(req.body.paymentMethod || "").trim().toLowerCase();
    if (paymentMethod === "mobile-money") {
      throw new Error("Use the momo charge endpoint for mobile money.");
    }

    if (paymentMethod !== "card") {
      throw new Error("Paystack checkout is only available for card here.");
    }

    const customerEmail = String(req.body.customerEmail || "").trim().toLowerCase();
    const customerPhone = String(req.body.customerPhone || "").trim();
    const momoProvider = String(req.body.momoProvider || "mtn").trim().toLowerCase();

    if (!customerEmail) {
      throw new Error("Customer email is required for Paystack checkout.");
    }

    const preview = await previewSale({
      items: req.body.items,
      discountAmount: req.body.discountAmount,
    });
    reference = generatePaystackReference();

    await createPendingPayment({
      reference,
      paymentMethod,
      checkoutAmount: preview.subtotal,
      customerEmail,
      customerPhone,
      payload: {
        items: req.body.items,
        customerId: req.body.customerId ? Number(req.body.customerId) : null,
        cashierId: req.user?.id || null,
        discountAmount: preview.discountAmount,
      },
    });

    const paystackPayload = {
      email: customerEmail,
      amount: Math.round(preview.subtotal * 100),
      currency: "GHS",
      reference,
      callback_url: getPaystackCallbackUrl(),
      channels: ["card"],
      metadata: {
        customer_phone: customerPhone || null,
        cashier_id: req.user?.id || null,
        customer_id: req.body.customerId ? Number(req.body.customerId) : null,
        discount_amount: preview.discountAmount,
        custom_fields: [
          ...(customerPhone
            ? [
                {
                  display_name: "Customer Phone",
                  variable_name: "customer_phone",
                  value: customerPhone,
                },
              ]
            : []),
        ],
      },
    };

    const paystackTransaction = await initializePaystackTransaction(paystackPayload);

    await updatePendingPaymentInitialization(reference, paystackTransaction.access_code);

    return res.json({
      reference,
      authorizationUrl: paystackTransaction.authorization_url,
      accessCode: paystackTransaction.access_code,
    });
  } catch (error) {
    if (reference) {
      await markPendingPaymentFailed(reference).catch(() => {});
    }

    return res.status(400).json({ error: error.message });
  }
}

export async function startMomoChargeApi(req, res) {
  let reference = "";
  let pendingPayment = null;
  try {
    if (!isPaystackConfigured()) {
      return res.status(500).json({
        error: "PAYSTACK_SECRET_KEY is not configured on the server.",
      });
    }

    const customerPhone = normalizeGhanaPhoneNumber(req.body.customerPhone);
    const momoProvider = normalizeMomoProvider(req.body.momoProvider);

    if (!customerPhone) {
      throw new Error("Customer phone number is required for mobile money checkout.");
    }

    const preview = await previewSale({
      items: req.body.items,
      discountAmount: req.body.discountAmount,
    });

    reference = generatePaystackReference();
    const customerEmail = String(req.body.customerEmail || "").trim().toLowerCase() ||
      buildWalkInEmail(customerPhone, reference);
    pendingPayment = await createPendingPayment({
      reference,
      paymentMethod: "mobile-money",
      checkoutAmount: preview.subtotal,
      customerEmail,
      customerPhone,
      payload: {
        items: req.body.items,
        customerId: req.body.customerId ? Number(req.body.customerId) : null,
        cashierId: req.user?.id || null,
        discountAmount: preview.discountAmount,
      },
    });

    const chargeData = await createPaystackCharge({
      email: customerEmail,
      amount: Math.round(preview.subtotal * 100),
      currency: "GHS",
      reference,
      mobile_money: {
        phone: customerPhone,
        provider: momoProvider,
      },
      metadata: {
        customer_phone: customerPhone,
        momo_provider: momoProvider,
        cashier_id: req.user?.id || null,
        customer_id: req.body.customerId ? Number(req.body.customerId) : null,
        discount_amount: preview.discountAmount,
      },
    });

    return respondToChargeStep({ res, pendingPayment, chargeData });
  } catch (error) {
    const effectiveReference = extractPaystackReference(error.paystackPayload, reference);

    if (effectiveReference && pendingPayment && isPinAuthorizationMessage(error.message)) {
      await updatePendingPaymentState(effectiveReference, {
        status: "initiated",
        payload: {
          ...pendingPayment.payload,
          lastChargeStatus: "send_pin",
        },
      }).catch(() => {});

      return res.json({
        nextAction: "pending",
        message: error.message,
        reference: effectiveReference,
      });
    }

    if (effectiveReference) {
      await markPendingPaymentFailed(effectiveReference).catch(() => {});
    }

    return res.status(400).json({
      error: error.message,
      reference: effectiveReference || null,
      details: error.paystackPayload || null,
    });
  }
}

export async function submitMomoAuthStepApi(req, res) {
  try {
    const reference = String(req.body.reference || "").trim();
    const action = String(req.body.action || "").trim().toLowerCase();
    const value = String(req.body.value || "").trim();

    if (!reference) {
      throw new Error("Payment reference is required.");
    }

    if (!value) {
      throw new Error("Authorization value is required.");
    }

    const pendingPayment = await getPendingPaymentByReference(reference);
    if (!pendingPayment) {
      throw new Error("Pending payment not found.");
    }

    let chargeData;
    if (action === "send_otp") {
      chargeData = await submitPaystackOtp(reference, value);
    } else if (action === "send_pin") {
      chargeData = await submitPaystackPin(reference, value);
    } else if (action === "send_phone") {
      chargeData = await submitPaystackPhone(reference, value);
    } else {
      throw new Error("Unsupported Paystack auth step.");
    }

    return respondToChargeStep({ res, pendingPayment, chargeData });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function checkMomoChargeStatusApi(req, res) {
  try {
    const reference = String(req.params.reference || "").trim();
    if (!reference) {
      throw new Error("Payment reference is required.");
    }

    const pendingPayment = await getPendingPaymentByReference(reference);
    if (!pendingPayment) {
      throw new Error("Pending payment not found.");
    }

    const chargeData = await checkPendingCharge(reference);

    if (chargeData.status === "success" || chargeData.paid_at) {
      const sale = await finalizeVerifiedPayment(reference, pendingPayment);
      return res.json({
        nextAction: "success",
        redirectUrl: `/receipts/${sale.id}`,
        reference,
      });
    }

    if (["send_otp", "send_pin", "send_phone"].includes(chargeData.status)) {
      return respondToChargeStep({ res, pendingPayment, chargeData });
    }

    const verifiedSale = await tryFinalizeIfVerified(reference, pendingPayment);
    if (verifiedSale) {
      return res.json({
        nextAction: "success",
        redirectUrl: `/receipts/${verifiedSale.id}`,
        reference,
      });
    }

    return res.json({
      nextAction: "pending",
      reference,
      message:
        pendingPayment.payload?.lastChargeStatus === "send_pin"
          ? "PIN submitted. Waiting for payment confirmation from the mobile money provider."
          : chargeData.display_text ||
            chargeData.gateway_response ||
            "Still waiting for customer authorization.",
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function handlePaystackCallback(req, res) {
  const reference = String(req.query.reference || "").trim();
  if (!reference) {
    return res.redirect("/pos?payment=missing_reference");
  }

  try {
    const existingSale = await getSaleByPaystackReference(reference);
    if (existingSale) {
      return res.redirect(`/receipts/${existingSale.id}`);
    }

    const pendingPayment = await getPendingPaymentByReference(reference);
    if (!pendingPayment) {
      return res.redirect("/pos?payment=unknown_reference");
    }

    const verification = await verifyPaystackTransaction(reference);
    if (verification.status !== "success") {
      await markPendingPaymentFailed(reference);
      return res.redirect("/pos?payment=failed");
    }

    const amountPaid = Number(verification.amount) / 100;
    const sale = await createSale({
      items: pendingPayment.payload.items,
      customerId: pendingPayment.payload.customerId,
      cashierId: pendingPayment.payload.cashierId,
      paymentMethod: pendingPayment.paymentMethod,
      amountPaid,
      discountAmount: pendingPayment.payload.discountAmount,
      paystackReference: reference,
      paystackTransactionId: verification.id,
    });

    await markPendingPaymentCompleted(reference, {
      saleId: sale.id,
      transactionId: verification.id,
    });

    return res.redirect(`/receipts/${sale.id}`);
  } catch (error) {
    return res.redirect(`/pos?payment_error=${encodeURIComponent(error.message)}`);
  }
}

export async function getReceiptPage(req, res, next) {
  const sale = await getSaleById(req.params.id);
  if (!sale) {
    return next();
  }

  const [customer, cashier] = await Promise.all([
    sale.customerId ? getCustomerById(sale.customerId) : Promise.resolve(null),
    sale.cashierId ? findUserById(sale.cashierId) : Promise.resolve(null),
  ]);

  const receipt = buildReceiptViewModel({ sale, customer, cashier });

  return res.render("reciepts/reciept", {
    title: "Receipt",
    pageTitle: "Receipt",
    receipt,
  });
}
