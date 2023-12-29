unsigned long long int logicalId = 0;
int hasData = 1;

jasync calculateGradient(int data[], int dataTag) {
    printf("computing gradient for data %d\n", dataTag);

    jsys.sleep(100000); // TODO

    jarray int gradient[128] = {1, 2, 3};

    printf("writing to uflow %d\n", dataTag);
    struct gradient_update_t gradient_wrapper = {.dataTag = dataTag, .logicalId = logicalId, .gradient = gradient};
    gradients.write(&gradient_wrapper);
}


jasync dataFetch() {
    logicalId = getLogicalIdLocal();
    printf("got logical id %d\n", logicalId);

    jarray int data[128];
    while (hasData) {
        data = getNextDataLocal(logicalId);
        if (data.len) {
            int dataTag = data.data[--data.len];
            calculateGradient(&data, dataTag);
        }
    }
}


int main(int argc, char* argv[]) {
    dataFetch();

    return 0;
}
