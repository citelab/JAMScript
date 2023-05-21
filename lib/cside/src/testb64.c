#include <stdio.h>
#include "base64.h"
#include <tinycbor/cbor.h>


int main() {

    int x = 145;

    char buf[64];
    char out[128];

    CborEncoder encoder;
    cbor_encoder_init(&encoder, buf, 10, 0);
    cbor_encode_int(&encoder, x);
    printf("Length %zu \n", cbor_encoder_get_buffer_size(&encoder, out));

    Base64encode(out, buf, 10);
    printf("\n%s\n", out);
}
