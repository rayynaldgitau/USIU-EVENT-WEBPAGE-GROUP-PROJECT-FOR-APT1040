// functions/index.js (Node / Firebase Functions)
const functions = require("firebase-functions");
const axios = require("axios");

// Put these into env config: functions:config:set mpesa.consumer_key="..." etc.
const MPESA_CONSUMER_KEY = functions.config().mpesa.consumer_key;
const MPESA_CONSUMER_SECRET = functions.config().mpesa.consumer_secret;
const MPESA_SHORTCODE = functions.config().mpesa.shortcode;   // e.g. Paybill
const MPESA_PASSKEY = functions.config().mpesa.passkey;       // from Safaricom
const MPESA_ENV = "sandbox"; // or "production"

const baseUrl =
  MPESA_ENV === "sandbox"
    ? "https://sandbox.safaricom.co.ke"
    : "https://api.safaricom.co.ke";

// Helper to get OAuth token
async function getAccessToken() {
  const auth = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await axios.get(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return res.data.access_token;
}

exports.mpesaStkPush = functions.https.onRequest(async (req, res) => {
  // Basic CORS (adjust origin to your real domain)
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { phone, amount, accountReference, description } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: "Missing phone or amount" });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14); 

    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const token = await getAccessToken();

    const stkRes = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Number(amount),
        PartyA: phone,              // customer phone 2547...
        PartyB: MPESA_SHORTCODE,    // your paybill/till
        PhoneNumber: phone,         // customer phone
        CallBackURL:
          "https://YOUR_CLOUD_FUNCTION_URL/mpesaCallback", // implement later
        AccountReference: accountReference || "USIU Event",
        TransactionDesc: description || "USIU Event Ticket",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      merchantRequestId: stkRes.data.MerchantRequestID,
      checkoutRequestId: stkRes.data.CheckoutRequestID,
      responseCode: stkRes.data.ResponseCode,
      responseDescription: stkRes.data.ResponseDescription,
      customerMessage: stkRes.data.CustomerMessage,
    });
  } catch (err) {
    console.error("M-Pesa STK error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Failed to start M-Pesa payment",
      details: err.response?.data || err.message,
    });
  }
});
