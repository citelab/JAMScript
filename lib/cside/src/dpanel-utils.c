
#include <tinycbor/cbor.h>
#include "dpanel.h"

#define MIN_VOID_SIZE               1024

int estimate_cbor_buffer_len(darg_t *u, int n)
{
    int len = 0;

    for (int i = 0; i < n; i++) {
        switch(u[i].type) {
        case D_NULL_TYPE:
            len += 1;
            break;
        case D_STRING_TYPE:
            len += sizeof(u[i].val.sval);
            break;
        case D_INT_TYPE:
            len += sizeof(u[i].val.ival);
            break;
        case D_LONG_TYPE:
            len += sizeof(u[i].val.lval);
            break;
        case D_DOUBLE_TYPE:
            len += sizeof(u[i].val.dval);
            break;
        case D_NVOID_TYPE:
            len += u[i].val.nval->len;
            break;
        case D_VOID_TYPE:
            len += MIN_VOID_SIZE;
            break;
        }

    }

    return len;
}

void do_cbor_encoding(CborEncoder* enc, darg_t* u, int n)
{
    CborEncoder mapEncoder;
    cbor_encoder_create_map(enc, &mapEncoder, n);

    for (int i = 0; i < n; i++) {
        cbor_encode_text_stringz(&mapEncoder, u[i].label);
        switch(u[i].type) {
        case D_STRING_TYPE:
            cbor_encode_text_stringz(&mapEncoder, u[i].val.sval);
            break;
        case D_INT_TYPE:
            cbor_encode_int(&mapEncoder, u[i].val.ival);
            break;
        case D_LONG_TYPE:
            cbor_encode_int(&mapEncoder, u[i].val.lval);
            break;
        case D_DOUBLE_TYPE:
            cbor_encode_double(&mapEncoder, u[i].val.dval);
            break;
        case D_NULL_TYPE:
            cbor_encode_null(&mapEncoder);
            break;
        case D_NVOID_TYPE:
            cbor_encode_byte_string(&mapEncoder, &u[i].val.nval.data, u[i].val.nval.len);
            break;
        default:
            printf("Unkown type %d in do_cbor_encoding\n", u[i].type);
        }

    }
    cbor_encoder_close_container(enc, &mapEncoder);
}

void free_buffer(darg_t* u, int n)
{
    for (int i = 0; i < n; i++) {
        if (u[i].label != NULL)
            free(u[i].label);
        switch(u[i].type) {
        case D_STRING_TYPE:
            free(u[i].val.sval);
            break;
        case D_NVOID_TYPE:
            nvoid_free(u[i].val.nval);
            break;
        case D_VOID_TYPE:
            if (u[i].val.vval != NULL)
                free(u[i].val.vval);
        }
    }
    free(u);
}

int __extract_int(const uint8_t* buffer, size_t len)
{
    CborParser parser;
    CborValue value;
    int result;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    cbor_value_get_int(&value, &result);
    return result;
}

long long int __extract_long(const uint8_t* buffer, size_t len)
{
    CborParser parser;
    CborValue value;
    long long int result;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    cbor_value_get_int64(&value, &result);
    return result;
}

double __extract_double(const uint8_t* buffer, size_t len)
{
    CborParser parser;
    CborValue value;
    double result;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    cbor_value_get_double(&value, &result);
    return result;
}

// TODO we want this to be with a fixed buffer ...
char* __extract_str(const uint8_t* buffer, size_t len)
{
    CborParser parser;
    CborValue value;
    cbor_parser_init(buffer, len, 0, &parser, &value);
    size_t n;
    cbor_value_calculate_string_length(&value, &n);
    char* x = calloc(n+1, sizeof(char)); // and maybe avoid this :))
    cbor_value_copy_text_string(&value, x, &n, NULL);
    return x;
}

darg_entry_t* __extract_map(const uint8_t* buffer, size_t len, darg_entry_t* dargs)
{
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
        cbor_value_dup_text_string(&map, &field, &n, &map)
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
                int len = darg->loc.nval->len;
                char* strloc = (char*)&darg->loc.nval->data;
                cbor_value_calculate_string_length(&map, &n);
                n++;
                if (n > len) {
                    printf("CBOR recieved string of length %d, max possible is %d\n", n, len);
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
                int len = darg->loc.nval->len;
                uint8_t* bytesloc = (uint8_t*)&darg->loc.nval->data;
                cbor_value_calculate_string_length(&map, &n);
                if (n > len) {
                    printf("CBOR recieved nvoid of length %d, max possible is %d\n", n, len);
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
                cbor_value_get_int(&map, darg->loc.dval);
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
