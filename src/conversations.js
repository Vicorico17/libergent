function stableHash(value = "") {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\s+/g, "").trim();
}

function getMessageTime(row = {}) {
  return String(row.received_at || row.created_at || new Date(0).toISOString());
}

function getListingMetadata(row = {}) {
  const listing = row.raw?.listing;
  return listing && typeof listing === "object" ? listing : {};
}

function conversationKey(phone, listingUrl = "") {
  return `${normalizePhone(phone)}::${String(listingUrl || "")}`;
}

function conversationId(phone, listingUrl = "") {
  return `wa_${stableHash(conversationKey(phone, listingUrl))}`;
}

function inferConversationStatus(messages) {
  const inbound = messages.filter((message) => message.direction === "inbound");
  if (!inbound.length) return "contacted";

  const text = inbound.map((message) => message.text.toLowerCase()).join(" ");
  if (/nu mai (este|e) disponibil|s-a vandut|s a vandut|vandut|vândut|indisponibil/.test(text)) return "unavailable";
  if (/de acord|ramane stabilit|rămâne stabilit|batut palma|bătut palma|ne-am inteles|ne am inteles/.test(text)) return "deal_agreed";
  if (/pret|preț|oferta|ofertă|negoci|ultimul pret|ultimul preț/.test(text)) return "negotiating";
  return "replied";
}

function createConversation(phone, listing = {}, timestamp = "") {
  const listingUrl = String(listing.url || "");
  return {
    id: conversationId(phone, listingUrl),
    channel: "whatsapp",
    sellerPhone: normalizePhone(phone),
    marketplace: String(listing.marketplace || listing.source || ""),
    listingUrl,
    listingTitle: String(listing.title || "Conversație WhatsApp"),
    listingImageUrl: String(listing.imageUrl || listing.image || ""),
    listingPrice: String(listing.price || listing.priceLabel || ""),
    searchQuery: String(listing.query || ""),
    status: "contacted",
    lastMessageAt: timestamp,
    messages: []
  };
}

export function buildConversationHistory(rows = [], { userId = "" } = {}) {
  const privateRows = userId
    ? rows.filter((row) => String(row.raw?.userId || "") === String(userId))
    : rows;
  const orderedRows = [...privateRows].sort((a, b) => getMessageTime(a).localeCompare(getMessageTime(b)));
  const conversations = new Map();
  const conversationsByPhone = new Map();

  for (const row of orderedRows) {
    const direction = row.direction === "inbound" ? "inbound" : "outbound";
    const phone = normalizePhone(direction === "inbound" ? row.from_number : row.to_number);
    if (!phone) continue;

    const listing = getListingMetadata(row);
    const listingUrl = String(listing.url || "");
    let conversation;
    if (direction === "outbound" && listingUrl) {
      const key = conversationKey(phone, listingUrl);
      conversation = conversations.get(key);
      if (!conversation) {
        conversation = createConversation(phone, listing, getMessageTime(row));
        conversations.set(key, conversation);
        const phoneConversations = conversationsByPhone.get(phone) || [];
        phoneConversations.push(conversation);
        conversationsByPhone.set(phone, phoneConversations);
      }
    } else {
      const phoneConversations = conversationsByPhone.get(phone) || [];
      conversation = phoneConversations[phoneConversations.length - 1];
      if (!conversation) {
        const key = conversationKey(phone, "");
        conversation = conversations.get(key) || createConversation(phone, {}, getMessageTime(row));
        conversations.set(key, conversation);
        conversationsByPhone.set(phone, [conversation]);
      }
    }

    const timestamp = getMessageTime(row);
    conversation.messages.push({
      id: String(row.message_id || `${direction}:${timestamp}:${row.text || ""}`),
      direction,
      role: direction === "inbound" ? "seller" : "agent",
      text: String(row.text || ""),
      timestamp
    });
    conversation.lastMessageAt = timestamp;
  }

  return [...conversations.values()]
    .map((conversation) => ({
      ...conversation,
      status: inferConversationStatus(conversation.messages),
      messageCount: conversation.messages.length,
      lastMessage: conversation.messages[conversation.messages.length - 1]?.text || ""
    }))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function getConversationById(rows, id, options = {}) {
  return buildConversationHistory(rows, options).find((conversation) => conversation.id === id) || null;
}
