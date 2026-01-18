import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface DatastoreResourcesProps {
  removalPolicy: cdk.RemovalPolicy;
}

export class DatastoreResources extends Construct {
  public readonly table: cdk.aws_dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatastoreResourcesProps) {
    super(scope, id);

    this.table = new cdk.aws_dynamodb.Table(this, "Table", {
      partitionKey: {
        name: "id",
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      removalPolicy: props.removalPolicy,
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // GSI to query items by entity type and updatedAt (sort key) so we can efficiently
    // fetch items modified after a timestamp (used by sync operation)
    this.table.addGlobalSecondaryIndex({
      indexName: "entityType-index",
      partitionKey: {
        name: "entityType",
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "updatedAt",
        type: cdk.aws_dynamodb.AttributeType.NUMBER,
      },
      projectionType: cdk.aws_dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, "TableName", {
      value: this.table.tableName,
    });
  }
}
