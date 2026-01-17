import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface ApiResourcesProps {
  createAuthorizer: boolean;
}

export class ApiResources extends Construct {
  public readonly api: cdk.aws_apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiResourcesProps) {
    super(scope, id);

    this.api = new cdk.aws_apigateway.RestApi(this, "Api", {
      defaultCorsPreflightOptions: {
        allowOrigins: cdk.aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      },
    });

    // Basic health endpoint
    const ping = this.api.root.addResource("ping");
    ping.addMethod(
      "GET",
      new cdk.aws_apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: { "application/json": '{"status":"ok"}' },
          },
        ],
        requestTemplates: { "application/json": '{"statusCode": 200}' },
      }),
      {
        methodResponses: [{ statusCode: "200" }],
      }
    );
  }
}
