import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function isPaystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

function getHeaders() {
  if (!isPaystackConfigured()) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

export function getPaystackCallbackUrl() {
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${appBaseUrl.replace(/\/$/, "")}/payments/paystack/callback`;
}

export function validatePaystackRuntime() {
  if (!isPaystackConfigured()) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  const appBaseUrl = process.env.APP_BASE_URL || "";
  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL is not configured.");
  }
}

export async function initializePaystackTransaction(payload) {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data.status !== true) {
    throw new Error(
      data?.message ||
        data?.data?.message ||
        "Unable to initialize Paystack transaction.",
    );
  }

  return data.data;
}

async function postChargeAction(path, payload) {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== true) {
    const error = new Error(
      data?.message ||
        data?.data?.message ||
        "Unable to complete Paystack charge request.");
    error.paystackStatusCode = response.status;
    error.paystackPayload = data;
    throw error;
  }

  return data.data;
}

export async function createPaystackCharge(payload) {
  return postChargeAction("/charge", payload);
}

export async function submitPaystackOtp(reference, otp) {
  return postChargeAction("/charge/submit_otp", { reference, otp });
}

export async function submitPaystackPin(reference, pin) {
  return postChargeAction("/charge/submit_pin", { reference, pin });
}

export async function submitPaystackPhone(reference, phone) {
  return postChargeAction("/charge/submit_phone", { reference, phone });
}

export async function checkPendingCharge(reference) {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/charge/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: getHeaders(),
    },
  );

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== true) {
    throw new Error(
      data?.message ||
        data?.data?.message ||
        "Unable to check pending Paystack charge.",
    );
  }

  return data.data;
}

export async function verifyPaystackTransaction(reference) {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: getHeaders(),
    },
  );

  const data = await response.json().catch(() => null);
  if (!response.ok || data.status !== true) {
    throw new Error(
      data?.message ||
        data?.data?.message ||
        "Unable to verify Paystack transaction.",
    );
  }

  return data.data;
}

export function verifyWebhookSignature(body) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return false;
  }

  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(body))
    .digest("hex");

  return hash;
}
