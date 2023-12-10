

jasync calculateGradient(int data[]) {
    int dataTag = 1;
    printf("computing gradient for data %d\n", dataTag);

    while (1) {
        printf("Before sleep... \n");
        jsys.sleep(10000000); // TODO
        jarray int gradient[128] = {1, 2, 3};

        printf("writing to uflow %d\n", dataTag);
        struct gradient_update_t gradient_wrapper = {.dataTag = dataTag, .logicalId = 1221, .gradient = gradient};
        gradients.write(&gradient_wrapper);
        dataTag++;
    }
}


int main(int argc, char* argv[]) {
    jarray int data[128] = {1, 2, 34, 5, 67, 76};

//    for (int i = 0; i < 1000; i++)
    calculateGradient(&data);

    return 0;
}
