package com.cloudlabhk.scheduler;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import com.amazonaws.regions.Regions;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClient;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBSaveExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.amazonaws.services.dynamodbv2.model.ConditionalOperator;
import com.amazonaws.services.dynamodbv2.model.ExpectedAttributeValue;
import com.amazonaws.services.dynamodbv2.model.ScanRequest;
import com.amazonaws.services.dynamodbv2.model.ScanResult;
import com.amazonaws.services.lambda.AWSLambdaClient;
import com.amazonaws.services.lambda.invoke.LambdaSerializationException;
import com.amazonaws.services.lambda.model.*;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.util.ImmutableMapParameter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.fortuna.ical4j.data.ParserException;
import org.joda.time.DateTime;

public class LambdaFunctionHandler implements RequestHandler<Object, Object> {
    final static String calenderTableName = "calendar";
    final static String calenderTeacherAttributeName = "teacher";
    final static String calenderIcsUrlAttributeName = "icsUrl";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Object handleRequest(Object input, Context context) {
        context.getLogger().log("Checking calender " + DateTime.now());
        ScanRequest scanRequest = new ScanRequest().withTableName(calenderTableName)
                .withProjectionExpression(calenderTeacherAttributeName + "," + calenderIcsUrlAttributeName);

        AmazonDynamoDBClient client = new AmazonDynamoDBClient();
        DynamoDBMapper mapper = new DynamoDBMapper(client);
        client.withRegion(getRegion(context));

        ScanResult result = client.scan(scanRequest);
        // http://stackoverflow.com/questions/28081401/dynamodbmapper-for-conditional-saves
        DynamoDBSaveExpression saveExpression = new DynamoDBSaveExpression();
        Map<String, ExpectedAttributeValue> expectedAttributes = ImmutableMapParameter
                .<String, ExpectedAttributeValue>builder()
                .put(calenderTeacherAttributeName, new ExpectedAttributeValue(false))
                .put(calenderIcsUrlAttributeName, new ExpectedAttributeValue(false))
                .build();
        saveExpression.setExpected(expectedAttributes);
        saveExpression.setConditionalOperator(ConditionalOperator.AND);

        for (Map<String, AttributeValue> item : result.getItems()) {
            CalenderReader calenderReader = new CalenderReader();
            String teacher = item.get(calenderTeacherAttributeName).getS();
            try {
                List<Lab> labs = calenderReader.getComingLab(item.get(calenderIcsUrlAttributeName).getS(), teacher);
                // To prevent overwrite, we cannot use batch write, but it is
                // fine! since there should not be many records!
                labs.forEach(lab -> {
                    try {
                        //Repeated Record will throw exception here and skip the function invoke!
                        context.getLogger().log("Found Coming Lab" + lab);
                        mapper.save(lab, saveExpression);

                        AWSLambdaClient lambda = new AWSLambdaClient();
                        lambda.configureRegion(getRegion(context));

                        InvokeRequest invokeRequest = buildInvokeRequest("AWSCloudLabBuilder", lab);
                        InvokeResult invokeResult = lambda.invoke(invokeRequest);
                        context.getLogger().log(invokeResult.getLogResult());
                        context.getLogger().log("Invoked Lab Builder");

                    } catch (ConditionalCheckFailedException ex) {
                        context.getLogger().log("Record Exist:" + lab.toString());
                    }
                });
            } catch (IOException | ParserException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
                context.getLogger().log(e.toString());
            }
        }
        return "Scheduler Run Completed!";
    }

    private static InvokeRequest buildInvokeRequest(String functionName, Object input) {

        InvokeRequest invokeRequest = new InvokeRequest();
        invokeRequest.setFunctionName(functionName); // Lambda function name identifier
        invokeRequest.setInvocationType(InvocationType.RequestResponse);
        invokeRequest.setLogType(LogType.None);

        if (input != null) {
            try {

                String payload = MAPPER.writer().writeValueAsString(input);
                invokeRequest.setPayload(payload);

            } catch (JsonProcessingException ex) {
                throw new LambdaSerializationException("Failed to serialize request object to JSON", ex);
            }
        }

        return invokeRequest;
    }

    private Regions getRegion(Context context) {
        String[] segments = context.getInvokedFunctionArn().split(":");
        return Regions.fromName(segments[3]);
    }

}
