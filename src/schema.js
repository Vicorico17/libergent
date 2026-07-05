export function buildListingSchema(limit) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        maxItems: limit,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            price: { type: "string" },
            currency: { type: "string" },
            location: { type: "string" },
            postedAt: { type: "string" },
            condition: { type: "string" },
            sellerType: { type: "string" },
            sourceType: { type: "string" },
            url: { type: "string" },
            imageUrl: { type: "string" },
            imageUrls: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["title"]
        }
      }
    },
    required: ["items"]
  };
}
