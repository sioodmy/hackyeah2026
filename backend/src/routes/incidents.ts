import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { randomUUID } from "node:crypto";

// In-memory incidents and heatmap data around Kraków center (Kazimierz, Stare Miasto, Podgórze, Dworzec Główny)
const mockFeatures = [
  {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [19.9373, 50.0617] as [number, number],
    },
    properties: {
      count: 14,
      weight: 0.85,
      severity: 2,
      category: "harassment",
      categoryLabel: "Zaczepki słowne",
    },
  },
  {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [19.945, 50.052] as [number, number],
    },
    properties: {
      count: 9,
      weight: 0.65,
      severity: 2,
      category: "stalking",
      categoryLabel: "Śledzenie",
    },
  },
  {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [19.948, 50.066] as [number, number],
    },
    properties: {
      count: 18,
      weight: 1.0,
      severity: 3,
      category: "robbery",
      categoryLabel: "Kradzież / Zastraszanie",
    },
  },
  {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [19.954, 50.046] as [number, number],
    },
    properties: {
      count: 5,
      weight: 0.4,
      severity: 1,
      category: "suspicious",
      categoryLabel: "Podejrzane zachowanie",
    },
  },
  {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [19.925, 50.058] as [number, number],
    },
    properties: {
      count: 7,
      weight: 0.5,
      severity: 2,
      category: "harassment",
      categoryLabel: "Zaczepki słowne",
    },
  },
];

interface ReportedIncident {
  id: string;
  category: string;
  severity: number;
  lat: number;
  lng: number;
  title?: string;
  description?: string;
  reportedAt: string;
}

const mockIncidents: ReportedIncident[] = [
  {
    id: randomUUID(),
    category: "harassment",
    severity: 2,
    lat: 50.0617,
    lng: 19.9373,
    title: "Nieprzyjemne zaczepki",
    description: "Grupa mężczyzn zaczepiała przechodniów",
    reportedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: randomUUID(),
    category: "stalking",
    severity: 2,
    lat: 50.052,
    lng: 19.945,
    title: "Śledzenie po zmroku",
    description: "Mężczyzna szedł za mną przez kilkaset metrów",
    reportedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

const heatmapFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    count: z.number(),
    weight: z.number(),
    severity: z.number(),
    category: z.string(),
    categoryLabel: z.string(),
  }),
});

const heatmapGeoJSONSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(heatmapFeatureSchema),
});

const reportIncidentBodySchema = z.object({
  category: z.string(),
  severity: z.number().optional().default(1),
  lat: z.number(),
  lng: z.number(),
  weight: z.number().optional().default(0.5),
  title: z.string().optional(),
  description: z.string().optional(),
  reportedAt: z.string().optional(),
});

export const incidentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/incidents/heatmap",
    {
      schema: {
        tags: ["incidents"],
        summary: "Incident heatmap geojson data",
        response: {
          200: heatmapGeoJSONSchema,
        },
      },
    },
    async () => {
      return {
        type: "FeatureCollection" as const,
        features: mockFeatures,
      };
    },
  );

  app.get(
    "/incidents/stats",
    {
      schema: {
        tags: ["incidents"],
        summary: "Incident statistics for Krakow",
      },
    },
    async () => {
      const total = mockFeatures.reduce(
        (acc, f) => acc + f.properties.count,
        0,
      );
      const byCategory: Record<string, number> = {};
      for (const f of mockFeatures) {
        byCategory[f.properties.category] =
          (byCategory[f.properties.category] ?? 0) + f.properties.count;
      }
      const hotspots = mockFeatures.slice(0, 3).map((f) => ({
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        count: f.properties.count,
      }));

      return {
        total,
        city: "Kraków",
        byCategory,
        hotspots,
      };
    },
  );

  app.get(
    "/incidents",
    {
      schema: {
        tags: ["incidents"],
        summary: "List recent incidents",
      },
    },
    async () => {
      return mockIncidents;
    },
  );

  app.post(
    "/incidents",
    {
      schema: {
        tags: ["incidents"],
        summary: "Report a dangerous situation or incident",
        body: reportIncidentBodySchema,
      },
    },
    async (request, reply) => {
      const body = request.body;
      const incident: ReportedIncident = {
        id: randomUUID(),
        category: body.category,
        severity: body.severity ?? 1,
        lat: body.lat,
        lng: body.lng,
        title: body.title,
        description: body.description,
        reportedAt: body.reportedAt ?? new Date().toISOString(),
      };
      mockIncidents.unshift(incident);

      // Also add or increment nearby point in heatmap
      const existing = mockFeatures.find((f) => {
        const dLng = Math.abs(f.geometry.coordinates[0] - body.lng);
        const dLat = Math.abs(f.geometry.coordinates[1] - body.lat);
        return dLng < 0.005 && dLat < 0.005;
      });

      if (existing) {
        existing.properties.count += 1;
        existing.properties.weight = Math.min(
          1.0,
          existing.properties.weight + 0.1,
        );
        if ((body.severity ?? 1) > existing.properties.severity) {
          existing.properties.severity = body.severity ?? 1;
        }
      } else {
        mockFeatures.push({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [body.lng, body.lat] as [number, number],
          },
          properties: {
            count: 1,
            weight: 0.4,
            severity: body.severity ?? 1,
            category: body.category,
            categoryLabel: body.title || "Zgłoszenie użytkownika",
          },
        });
      }

      return reply.status(201).send(incident);
    },
  );
};
