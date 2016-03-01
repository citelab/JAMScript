/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

#include <nanomsg/nn.h>
#include <assert.h>
#include <stdlib.h>

#include "econtext.h"


// initialize the c_core
// get the context, try to connect the fog, if not to the cloud
// if we are able to connect to the cloud, get the fog information and
// try fog connection.

// we can specify a timeout value in milliseconds to complete the initialization.
// A timeout of -1 is indefinite wait.

// Initialization completes only when we are able to connect to the Fog.
// We could complete this by either directly connecting to the Fog server that
// might have been specified or by indirect means through the cloud discovery
// service.

e_context_t *init_c_core(int timeout)
{
    // get execution context
    e_context_t *ctx = get_exec_context();
    assert(ctx != NULL);

    // Connect to Fog servers if they are available..
    if (!connect_to_fog(ctx, true) < 0) {
        // if unable to connect to fog, now try the cloud..
        // we need at least the cloud to move forward..

        if (connect_to_cloud(ctx, timeout)) {
            // If the cloud connection is a success we should have new Fog
            // servers in the list.. lets connect to them..
            if (connect_to_fog(ctx, (timeout > 0)))
                return ctx;
            else
                return NULL;
        }
        else
        {
            printf("ERROR!! Unable to connect to cloud.. \n");
            return NULL;
        }
    }
    else
    return ctx;             // we were able to connect to a specified Fog
}





// once connected, go to the next phase.. run activities on J-core (Fog)
// or run activities in local node (C-core) for the Fog.
