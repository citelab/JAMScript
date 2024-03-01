#include <tinycbor/cbor.h>
#include "dpanel.h"

void do_nvoid_encoding(CborEncoder* enc, nvoid_t* nv) {
    if (nv->typefmt == 'c')
        cbor_encode_text_string(enc, (char*)nv->data, nv->len);
    else if (nv->typefmt == 'b')
        cbor_encode_byte_string(enc, (uint8_t*)nv->data, nv->len);
    else {
        CborEncoder arrayEnc;
        cbor_encoder_create_array(enc, &arrayEnc, nv->len);
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wcast-align" /* We specify __aligned__ (8) on nvoids */
        switch(nv->typefmt) {
        case 'i':
            for (int i = 0; i < nv->len; i++)
                cbor_encode_int(&arrayEnc, (int64_t)((int*)nv->data)[i]);
            break;
        case 'u':
            for (int i = 0; i < nv->len; i++)
                cbor_encode_uint(&arrayEnc, (uint64_t)((unsigned int*)nv->data)[i]);
            break;
        case 'l':
            for (int i = 0; i < nv->len; i++)
                cbor_encode_int(&arrayEnc, (int64_t)((long long int*)nv->data)[i]);
            break;
        case 'z':
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
        case 'n':
            for (int i = 0; i < nv->len; i++)
                do_nvoid_encoding(&arrayEnc, (nvoid_t*)&(nv->data[i * nv->typesize]));
            break;
        default:
            assert(false);
        }
#pragma GCC diagnostic pop
        cbor_encoder_close_container(enc, &arrayEnc);
    }
}

void do_basic_type_encoding(CborEncoder* enc, char type, va_list* args) {
    switch(type) {
    case 'c':
    case 'i':
        cbor_encode_int(enc, (int64_t)va_arg(*args, int));
        break;
    case 'b':
    case 'u':
        cbor_encode_uint(enc, (uint64_t)va_arg(*args, unsigned int));
        break;
    case 'l':
        cbor_encode_int(enc, (int64_t)va_arg(*args, long long int));
        break;
    case 'z':
        cbor_encode_uint(enc, (uint64_t)va_arg(*args, unsigned long long int));
        break;
    case 'f':
        cbor_encode_float(enc, (float)va_arg(*args, double));
        break;
    case 'd':
        cbor_encode_double(enc, va_arg(*args, double));
        break;
    case 'C':
    case 'B':
    case 'I':
    case 'U':
    case 'L':
    case 'Z':
    case 'F':
    case 'D':
    case 'n':
        do_nvoid_encoding(enc, va_arg(*args, nvoid_t*));
        break;
    case 's': // deprecated
        cbor_encode_text_stringz(enc, va_arg(*args, char*));
        break;
    default:
        assert(false);
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

        do_basic_type_encoding(&mapEnc, fmt[i], &args);
    }
    cbor_encoder_close_container(enc, &mapEnc);
}

int __extract_cbor_type(CborValue* dec, void* loc, char type) {
    int tmp_int, error = 0;
    uint64_t tmp_uint;
    int64_t tmp_llint;
    size_t n;
    switch(cbor_value_get_type(dec)){
    case CborIntegerType:
        switch(type) {
        case 'c':
            cbor_value_get_int(dec, &tmp_int);
            *(char*)loc = (char)tmp_int;
            break;
        case 'b':
            cbor_value_get_uint64(dec, &tmp_uint);
            *(unsigned char*)loc = (unsigned char)tmp_uint;
            break;
        case 'i':
            cbor_value_get_int(dec, (int*)loc);
            break;
        case 'u':
            cbor_value_get_uint64(dec, &tmp_uint);
            *(unsigned int*)loc = (unsigned int)tmp_uint;
            break;
        case 'l':
            cbor_value_get_int64(dec, (int64_t*)loc);
            break;
        case 'z':
            cbor_value_get_uint64(dec, (uint64_t*)loc);
            break;
        case 'd':
            cbor_value_get_int64(dec, &tmp_llint);
            *(double*)loc = (double)tmp_llint;
            break;
        case 'f':
            cbor_value_get_int64(dec, &tmp_llint);
            *(double*)loc = (double)tmp_llint;
            break;
        default:
            printf("CBOR type mismatch: found Integer, expected %c\n", type);
            error = 1;
        }
        cbor_value_advance(dec);
        break;
    case CborTextStringType:
        if(type >= 'A' && type <= 'Z') {
            nvoid_t* nval = (nvoid_t*)loc;
            assert(nval->typefmt == type - 'A' + 'a');
            if(nval->typefmt == 'c' || nval->typefmt == 'b') {
                size_t len = nval->maxlen;
                char* strloc = (char*)nval->data;
                cbor_value_calculate_string_length(dec, &n);
                if (n++ > len) {
                    printf("CBOR recieved string of length %zu, max possible is %zu\n", n, len);
                    error = 1;
                    char* strnew = malloc(n * sizeof(char));
                    cbor_value_copy_text_string(dec, strnew, &n, dec);
                    memcpy(strloc, strnew, len - 1);
                    nval->len = len;
                    strloc[len - 1] = 0;
                    free(strnew);
                } else
                    cbor_value_copy_text_string(dec, strloc, &n, dec);
                break;
            }
        } else if (type == 'c' || type == 'b') {
            cbor_value_calculate_string_length(dec, &n);
            if (n++ == 1) { // We can parse a 1 character string as a char
                char strtmp[2];
                cbor_value_copy_text_string(dec, strtmp, &n, dec);
                *(char*)loc = strtmp[0];
                break;
            }
        }
        printf("CBOR type mismatch: found String, expected %c\n", type);
        error = 1;
        cbor_value_advance(dec);
        break;
    case CborByteStringType:
        if(type >= 'A' && type <= 'Z') {
            nvoid_t* nval = (nvoid_t*)loc;
            assert(nval->typefmt == type - 'A' + 'a');
            if(nval->typefmt == 'c' || nval->typefmt == 'b') {
                size_t len = nval->len;
                uint8_t* bytesloc = (uint8_t*)nval->data;
                cbor_value_calculate_string_length(dec, &n);
                if (n > len) {
                    printf("CBOR recieved nvoid of length %zu, max possible is %zu\n", n, len);
                    error = 1;
                    uint8_t* bytesnew = malloc(n);
                    cbor_value_copy_byte_string(dec, bytesnew, &n, dec);
                    memcpy(bytesloc, bytesnew, len);
                    nval->len = len;
                    free(bytesnew);
                } else {
                    nval->len = n;
                    cbor_value_copy_byte_string(dec, bytesloc, &n, dec);
                }
                break;
            }
        } else if (type == 'c' || type == 'b') {
            cbor_value_calculate_string_length(dec, &n);
            if (n == 1) { // We can parse a 1 character string as a char
                uint8_t strtmp[1];
                cbor_value_copy_byte_string(dec, strtmp, &n, dec);
                *(uint8_t*)loc = strtmp[0];
                break;
            }
        }
        printf("CBOR type mismatch: found Bytes, expected %c\n", type);
        error = 1;
        cbor_value_advance(dec);
        break;
    case CborDoubleType:
        if (type == 'd')
            cbor_value_get_double(dec, (double*)loc);
        else if (type == 'f')
            cbor_value_get_float(dec, (float*)loc);
        else {
            printf("CBOR type mismatch: found Double, expected %c\n", type);
            error = 1;
        }
        cbor_value_advance(dec);
        break;
    case CborArrayType:
        if(type >= 'A' && type <= 'Z') {
            nvoid_t* nval = (nvoid_t*)loc;
            assert(nval->typefmt == type - 'A' + 'a');
            CborValue arr;
            cbor_value_enter_container(dec, &arr);
            int overflowed = false, i = 0;
            for (;!cbor_value_at_end(&arr); i++)
                if (i >= nval->maxlen) {
                    cbor_value_advance(&arr);
                    overflowed = true;
                } else
                    error |= __extract_cbor_type(&arr, (void*)&(nval->data[i * nval->typesize]), (char)nval->typefmt);
            cbor_value_leave_container(dec, &arr);
            if (overflowed) {
                nval->len = nval->maxlen;
                printf("CBOR array overflow: had length %d, max allowed was %u\n", i, nval->maxlen);
                error = 1;
            } else
                nval->len = i;
        } else {
            printf("CBOR type mismatch: found Array, expected %c\n", type);
            error = 1;
            cbor_value_advance(dec);
        }
        break;
    default:
        printf("CBOR unknown type %x\n", cbor_value_get_type(dec));
        error = 1;
        cbor_value_advance(dec);
    }
    return error;
}

int __extract_basic_type(const uint8_t* buffer, size_t len, char type, void* loc) {
    CborParser parser;
    CborValue value;

    // printf("extracting dflow buf [%zu]:", len);
    // for (int i=0; i < len; i++)
    //     printf(" %.2x", i[buffer]);
    // putchar('\n');

    cbor_parser_init(buffer, len, 0, &parser, &value);
    return __extract_cbor_type(&value, loc, type);
}

int __extract_map(const uint8_t* buffer, size_t len, darg_entry_t* dargs) {
    int error = 0;
    darg_entry_t* darg,* tmp;
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
        if(!darg){
            printf("CBOR field not found in struct %s\n", field);
            error = 1;
            cbor_value_advance(&map);
            free(field);
            continue;
        }
        free(field);

        error |= __extract_cbor_type(&map, darg->loc, darg->type);

        HASH_DEL(dargs, darg);
    }

    HASH_ITER(hh, dargs, darg, tmp){
        printf("CBOR had no input for struct field %s\n", darg->label);
        error |= 1;
        HASH_DEL(dargs, darg);
    }
    return error;
}
