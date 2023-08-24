#include <tinycbor/cbor.h>
#include "dpanel.h"

void do_nvoid_encoding(CborEncoder* enc, nvoid_t* nv) {
    if (nvoid->typefmt == 'c')
        cbor_encode_text_string(enc, (char*)nv->data, nv->len);
    else if (nvoid->typefmt == 'C')
        cbor_encode_byte_string(enc, (uint8_t*)nv->data, nv->len);
    else {
        CborEncoder arrayEnc;
        cbor_encoder_create_array(enc, &arrayEnc, nv->len);
        switch(nvoid->typefmt) {
        case 'i':
            for (int i = 0; i < nv->len; i++)
                cbor_encode_int(&arrayEnc, (int64_t)((int*)nv->data)[i]);
            break;
        case 'I':
            for (int i = 0; i < nv->len; i++)
                cbor_encode_uint(&arrayEnc, (uint64_t)((unsigned int*)nv->data)[i]);
            break;
        case 'l':
            for (int i = 0; i < nv->len; i++)
                cbor_encode_int(&arrayEnc, (int64_t)((long long int*)nv->data)[i]);
            break;
        case 'L':
            for (int i = 0; i < nv->len; i++)
                cbor_encode_uint(&arrayEnc, (uint64_t)((unsigned long long int*)nv->data)[i]);
            break;
        case 'f':
            for (int i = 0; i < nv->len; i++)
                cbor_encode_float(&arrayEnc, ((float*)nv->data)[i]);
            break;
        case 'd':
            for (int i = 0; i < nv->len; i++)
                cbor_encode_double(&arrayEnc, ((double*)nv->data)[i]);
            break;
        default:
            assert(false);
        }
        cbor_encoder_close_container(enc, &arrayEnc);
    }
}

void do_struct_encoding(CborEncoder* enc, char* fmt, va_list args) {
    int len = strlen(fmt);
    assert(len > 0);

    CborEncoder mapEnc;
    cbor_encoder_create_map(enc, &mapEnc, len);

    for (int i = 0; i < len; i++) {
        char* label = va_arg(args, char*);
        cbor_encode_text_stringz(&mapEnc, label);
        switch(fmt[i]) {
        case 'c':
            cbor_encode_int(&mapEnc, (int64_t)va_arg(args, char));
            break;
        case 'C':
            cbor_encode_uint(&mapEnc, (uint64_t)va_arg(args, unsigned char));
            break;
        case 'i':
            cbor_encode_int(&mapEnc, (int64_t)va_arg(args, int));
            break;
        case 'I':
            cbor_encode_uint(&mapEnc, (uint64_t)va_arg(args, unsigned int));
            break;
        case 'l':
            cbor_encode_int(&mapEnc, (int64_t)va_arg(args, long long int));
            break;
        case 'L':
            cbor_encode_uint(&mapEnc, (uint64_t)va_arg(args, unsigned long long int));
            break;
        case 'f':
            cbor_encode_float(&mapEnc, va_arg(args, float));
            break;
        case 'd':
            cbor_encode_double(&mapEnc, va_arg(args, double));
            break;
        case 'n':
            do_nvoid_encoding(&mapEnc, va_arg(args, nvoid_t*));
            break;
        case 's':
            cbor_encode_text_stringz(&mapEnc, va_arg(args, char*));
            break;
        default:
            assert(false);
        }
    }
    cbor_encoder_close_container(enc, &mapEnc);
}

int __extract_int(const uint8_t* buffer, size_t len) {
    CborParser parser;
    CborValue value;
    int result;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    cbor_value_get_int(&value, &result);
    return result;
}

long long int __extract_long(const uint8_t* buffer, size_t len) {
    CborParser parser;
    CborValue value;
    long long int result;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    cbor_value_get_int64(&value, &result);
    return result;
}

double __extract_double(const uint8_t* buffer, size_t len) {
    CborParser parser;
    CborValue value;
    double result;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    cbor_value_get_double(&value, &result);
    return result;
}

// TODO we want this to be with a fixed buffer ...
char* __extract_str(const uint8_t* buffer, size_t len) {
    CborParser parser;
    CborValue value;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    size_t n;
    cbor_value_calculate_string_length(&value, &n);
    char* x = calloc(n+1, sizeof(char)); // and maybe avoid this :))
    cbor_value_copy_text_string(&value, x, &n, NULL);
    return x;
}

darg_entry_t* __extract_map(const uint8_t* buffer, size_t len, darg_entry_t* dargs) {
    darg_entry_t* darg;
    CborParser parser;
    CborValue value, map;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    assert(cbor_value_is_map(&value));
    cbor_value_enter_container(&value, &map);
    while(!cbor_value_at_end(&map)){
        size_t n;
        char* field;
        assert(cbor_value_is_text_string(&map));
        cbor_value_dup_text_string(&map, &field, &n, &map);
        HASH_FIND_STR(dargs, field, darg);
        free(field);
        if(!darg){
            printf("CBOR field not found in struct %s\n", field);
            cbor_value_advance(&map);
            continue;
        }
        switch(cbor_value_get_type(&map)){
        case CborIntegerType:
            if (darg->type == D_INT_TYPE)
                cbor_value_get_int(&map, darg->loc.ival);
            else if (darg->type == D_LONG_TYPE)
                cbor_value_get_int64(&map, darg->loc.lval);
            else
                printf("CBOR type mismatch: found Integer, expected %d\n", darg->type);
            cbor_value_advance(&map);
            break;
        case CborTextStringType:
            if(darg->type == D_STRING_TYPE) {
                size_t len = darg->loc.nval->len;
                char* strloc = (char*)&darg->loc.nval->data;
                cbor_value_calculate_string_length(&map, &n);
                n++;
                if (n > len) {
                    printf("CBOR recieved string of length %zu, max possible is %zu\n", n, len);
                    char* strnew = malloc(n * sizeof(char));
                    cbor_value_copy_text_string(&map, strnew, &n, &map);
                    memcpy(strloc, strnew, len - 1);
                    strloc[len - 1] = 0;
                    free(strnew);
                } else
                    cbor_value_copy_text_string(&map, strloc, &n, &map);
            } else {
                printf("CBOR type mismatch: found String, expected %d\n", darg->type);
                cbor_value_advance(&map);
            }
            break;
        case CborByteStringType:
            if(darg->type == D_NVOID_TYPE) {
                size_t len = darg->loc.nval->len;
                uint8_t* bytesloc = (uint8_t*)&darg->loc.nval->data;
                cbor_value_calculate_string_length(&map, &n);
                if (n > len) {
                    printf("CBOR recieved nvoid of length %zu, max possible is %zu\n", n, len);
                    uint8_t* bytesnew = malloc(n);
                    cbor_value_copy_byte_string(&map, bytesnew, &n, &map);
                    memcpy(bytesloc, bytesnew, len);
                    free(bytesnew);
                } else
                    cbor_value_copy_byte_string(&map, bytesloc, &n, &map);
            } else {
                printf("CBOR type mismatch: found Bytes, expected %d\n", darg->type);
                cbor_value_advance(&map);
            }
            break;
        case CborDoubleType:
            if (darg->type == D_DOUBLE_TYPE)
                cbor_value_get_double(&map, darg->loc.dval);
            else
                printf("CBOR type mismatch: found Double, expected %d\n", darg->type);
            cbor_value_advance(&map);
            break;
        default:
            printf("CBOR unknown type with key %s\n", field);
            cbor_value_advance(&map);
        }
        HASH_DEL(dargs, darg);
    }
    return dargs;
}
