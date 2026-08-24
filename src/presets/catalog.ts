/**
 * The cloud service catalog.
 *
 * Static data compiled into the app — no backend, no database, no network. A
 * service placed on the canvas becomes an ordinary component instance, and the
 * component definition travels inside the `.fluxx` file, so a diagram still
 * opens correctly on a build whose catalog has moved on.
 *
 * Ids are stable and namespaced (`aws:s3`). They double as the component
 * definition id, which is what lets the app recognise a placed node as "Amazon
 * S3" later without looking anything up.
 */

export type Provider = "aws" | "gcp" | "azure";

/**
 * Glyphs are drawn from FluxxDraw's own primitives rather than shipped as
 * vendor artwork: it keeps the hand-drawn look consistent, adds no bytes, and
 * sidesteps the licensing terms attached to the official icon sets. They mark
 * the *category* — the service name underneath does the identifying.
 */
export type Glyph =
  | "compute"
  | "function"
  | "container"
  | "storage"
  | "database"
  | "network"
  | "cdn"
  | "queue"
  | "analytics"
  | "security"
  | "ai";

export interface ServicePreset {
  /** `provider:slug`, also used as the component definition id */
  id: string;
  provider: Provider;
  /** shown on the node */
  name: string;
  category: string;
  glyph: Glyph;
}

export const PROVIDERS: Record<Provider, { name: string; accent: string }> = {
  aws: { name: "AWS", accent: "#e8850c" },
  gcp: { name: "Google Cloud", accent: "#3f7ff0" },
  azure: { name: "Azure", accent: "#0a7bc4" },
};

const service = (
  provider: Provider,
  slug: string,
  name: string,
  category: string,
  glyph: Glyph,
): ServicePreset => ({ id: `${provider}:${slug}`, provider, name, category, glyph });

export const SERVICES: ServicePreset[] = [
  // --- AWS ----------------------------------------------------------------
  service("aws", "ec2", "EC2", "Compute", "compute"),
  service("aws", "lambda", "Lambda", "Compute", "function"),
  service("aws", "step-functions", "Step Functions", "Compute", "function"),
  service("aws", "ecs", "ECS / Fargate", "Containers", "container"),
  service("aws", "eks", "EKS", "Containers", "container"),
  service("aws", "s3", "S3", "Storage", "storage"),
  service("aws", "ebs", "EBS", "Storage", "storage"),
  service("aws", "rds", "RDS", "Database", "database"),
  service("aws", "aurora", "Aurora", "Database", "database"),
  service("aws", "dynamodb", "DynamoDB", "Database", "database"),
  service("aws", "elasticache", "ElastiCache", "Database", "database"),
  service("aws", "vpc", "VPC", "Networking", "network"),
  service("aws", "alb", "Load Balancer", "Networking", "network"),
  service("aws", "route53", "Route 53", "Networking", "network"),
  service("aws", "api-gateway", "API Gateway", "Networking", "network"),
  service("aws", "cloudfront", "CloudFront", "Networking", "cdn"),
  service("aws", "sqs", "SQS", "Messaging", "queue"),
  service("aws", "sns", "SNS", "Messaging", "queue"),
  service("aws", "eventbridge", "EventBridge", "Messaging", "queue"),
  service("aws", "kinesis", "Kinesis", "Analytics", "analytics"),
  service("aws", "redshift", "Redshift", "Analytics", "analytics"),
  service("aws", "athena", "Athena", "Analytics", "analytics"),
  service("aws", "cloudwatch", "CloudWatch", "Analytics", "analytics"),
  service("aws", "iam", "IAM", "Security", "security"),
  service("aws", "cognito", "Cognito", "Security", "security"),
  service("aws", "secrets-manager", "Secrets Manager", "Security", "security"),
  service("aws", "sagemaker", "SageMaker", "AI / ML", "ai"),
  service("aws", "bedrock", "Bedrock", "AI / ML", "ai"),

  // --- Google Cloud -------------------------------------------------------
  service("gcp", "compute-engine", "Compute Engine", "Compute", "compute"),
  service("gcp", "cloud-run", "Cloud Run", "Compute", "container"),
  service("gcp", "cloud-functions", "Cloud Functions", "Compute", "function"),
  service("gcp", "gke", "GKE", "Containers", "container"),
  service("gcp", "cloud-storage", "Cloud Storage", "Storage", "storage"),
  service("gcp", "filestore", "Filestore", "Storage", "storage"),
  service("gcp", "cloud-sql", "Cloud SQL", "Database", "database"),
  service("gcp", "spanner", "Spanner", "Database", "database"),
  service("gcp", "firestore", "Firestore", "Database", "database"),
  service("gcp", "memorystore", "Memorystore", "Database", "database"),
  service("gcp", "vpc", "VPC", "Networking", "network"),
  service("gcp", "load-balancing", "Load Balancing", "Networking", "network"),
  service("gcp", "cloud-cdn", "Cloud CDN", "Networking", "cdn"),
  service("gcp", "pub-sub", "Pub/Sub", "Messaging", "queue"),
  service("gcp", "bigquery", "BigQuery", "Analytics", "analytics"),
  service("gcp", "dataflow", "Dataflow", "Analytics", "analytics"),
  service("gcp", "iam", "IAM", "Security", "security"),
  service("gcp", "secret-manager", "Secret Manager", "Security", "security"),
  service("gcp", "vertex-ai", "Vertex AI", "AI / ML", "ai"),

  // --- Azure --------------------------------------------------------------
  service("azure", "vm", "Virtual Machines", "Compute", "compute"),
  service("azure", "app-service", "App Service", "Compute", "compute"),
  service("azure", "functions", "Functions", "Compute", "function"),
  service("azure", "aks", "AKS", "Containers", "container"),
  service("azure", "container-apps", "Container Apps", "Containers", "container"),
  service("azure", "blob-storage", "Blob Storage", "Storage", "storage"),
  service("azure", "files", "Azure Files", "Storage", "storage"),
  service("azure", "sql", "Azure SQL", "Database", "database"),
  service("azure", "cosmos-db", "Cosmos DB", "Database", "database"),
  service("azure", "redis", "Cache for Redis", "Database", "database"),
  service("azure", "vnet", "Virtual Network", "Networking", "network"),
  service("azure", "front-door", "Front Door", "Networking", "cdn"),
  service("azure", "app-gateway", "App Gateway", "Networking", "network"),
  service("azure", "service-bus", "Service Bus", "Messaging", "queue"),
  service("azure", "event-hubs", "Event Hubs", "Messaging", "queue"),
  service("azure", "synapse", "Synapse", "Analytics", "analytics"),
  service("azure", "monitor", "Monitor", "Analytics", "analytics"),
  service("azure", "entra-id", "Entra ID", "Security", "security"),
  service("azure", "key-vault", "Key Vault", "Security", "security"),
  service("azure", "openai", "Azure OpenAI", "AI / ML", "ai"),
];

export const findService = (id: string): ServicePreset | undefined =>
  SERVICES.find((s) => s.id === id);

/** Services for one provider, grouped by category in catalog order. */
export const byCategory = (provider: Provider): { category: string; items: ServicePreset[] }[] => {
  const groups: { category: string; items: ServicePreset[] }[] = [];
  for (const item of SERVICES) {
    if (item.provider !== provider) continue;
    const group = groups.find((g) => g.category === item.category);
    if (group) group.items.push(item);
    else groups.push({ category: item.category, items: [item] });
  }
  return groups;
};
