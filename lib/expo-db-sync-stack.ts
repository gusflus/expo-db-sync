import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiResources } from "./constructs/api-resources";
import { DatastoreResources } from "./constructs/datastore-resources";

export class ExpoDbSyncStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Datastore (DynamoDB)
    const datastore = new DatastoreResources(this, "DatastoreResources", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // API Gateway
    const apiResources = new ApiResources(this, "ApiResources", {
      createAuthorizer: false,
    });

    // Sync Lambda - handles incoming items and returns items updated after lastSyncTimestamp
    const syncFn = new cdk.aws_lambda.Function(this, "SyncHandler", {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: cdk.aws_lambda.Code.fromAsset(
        require("path").join(__dirname, "..", "lambda", "dist")
      ),
      environment: {
        TABLE_NAME: datastore.table.tableName,
        ENTITY_INDEX: "entityType-index",
      },
    });

    // Allow Lambda to read/write the table
    datastore.table.grantReadWriteData(syncFn);

    // Wire the sync endpoint: POST /sync/{entityType}
    const sync = apiResources.api.root
      .addResource("sync")
      .addResource("{entityType}");
    const syncIntegration = new cdk.aws_apigateway.LambdaIntegration(syncFn);
    sync.addMethod("POST", syncIntegration);

    new cdk.CfnOutput(this, "ApiUrl", {
      value: apiResources.api.url,
    });

    new cdk.CfnOutput(this, "TableName", { value: datastore.table.tableName });
    new cdk.CfnOutput(this, "SyncFunctionName", { value: syncFn.functionName });
  }
}
