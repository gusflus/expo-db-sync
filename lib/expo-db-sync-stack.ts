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

    // Cognito User Pool for API auth
    const userPool = new cdk.aws_cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      userPoolName: `${this.stackName}-users`,
      signInAliases: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // API resources (creates RestApi and optional authorizer)
    const apiResources = new ApiResources(this, "ApiResources", {
      userPool,
      createAuthorizer: true,
    });

    // Add a simple /items GET endpoint (mock integration) protected by Cognito
    const items = apiResources.api.root.addResource("items");
    items.addMethod(
      "GET",
      new cdk.aws_apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": JSON.stringify({
                table: "${datastore.table.tableName}",
              }),
            },
          },
        ],
        requestTemplates: { "application/json": '{"statusCode": 200}' },
      }),
      {
        methodResponses: [{ statusCode: "200" }],
        authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
        authorizer: apiResources.authorizer,
      }
    );

    new cdk.CfnOutput(this, "ApiUrl", {
      value: apiResources.api.url,
    });

    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "TableName", { value: datastore.table.tableName });
  }
}
