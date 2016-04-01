
// Check whether there are any more pending JAM activities.
// If none are pending, we can exit the program right away.
// If some activities are pending, we defer the execution of the jam_exit(1).
//
int jam_exit(jamstate_t *js)
{
    if (jam_pending_acts(js) > 0) {
        //

    }

}

// Send a message to the J-core informing it that C-core (device) is ready.
// The J-core is supposed to engage with the C-core after it receives this message.
// If the C-core is not receiving any interactions.. it will repeat sending this message
// Assuming this message is lost..
//
// This function is invoked by the JAM program...
//
bool jam_core_ready(jamstate_t *js)
{

}



int jam_raise_event(jamstate_t *js, char *tag, EventType etype, char *cback, char *fmt, ...)
{

}


/*
 * Send the given event to the remote side.
 * tag - arbitrary value (activity name or something else)
 * cback - callback
 * format - s (string), i (integer) f,d for float/double - no % (e.g., "si")
 *
 */
int raise_event(Application *app, char *tag, EventType etype, char *cback, char *fmt, ...)
{
    va_list args;
    char fbuffer[BUFSIZE];
    char *bufptr = fbuffer;
    Command *cmd;

    va_start(args, fmt);

    while(*fmt)
    {
        switch(*fmt++)
        {
            case 's':
                bufptr = strcat(bufptr, "\"%s\"");
                break;
            case 'i':
                bufptr = strcat(bufptr, "%d");
                break;
            case 'f':
            case 'd':
                bufptr = strcat(bufptr, "%f");
                break;
            default:
                break;
        }
        if (*fmt)
            bufptr = strcat(bufptr, ",");
    }
    va_end(args);

    switch (etype){
        case ErrorEventType:
        cmd = command_format_jsonk("ERROR", tag, cback, bufptr, args);
        break;

        case CompleteEventType:
        cmd = command_format_jsonk("COMPLETE", tag, cback, bufptr, args);
        break;

        case CancelEventType:
        cmd = command_format_jsonk("CANCEL", tag, cback, bufptr, args);
        break;

        case VerifyEventType:
        cmd = command_format_jsonk("VERIFY", tag, cback, bufptr, args);
        break;

        case CallbackEventType:
        cmd = command_format_jsonk("CALLBACK", tag, cback, bufptr, args);
        break;
    }

    if (command_send(cmd, app->socket) != 0) {
        command_free(cmd);
        return -1;
    } else {
        command_free(cmd);
        return 0;
    }
}


/*
 * jam background loop. This loop is responsible for processing publish-subscribe,
 * survey-respondent, request-reply packets. The C-core does not take
 * unsolicited REQ packets. It is always a REPLY to a previous REQ packet.
 *
 * We launch this loop in a thread. Here is what happens in the loop
 * we read from the network for published and survey packets. This happens on the
 * SUBS and RESP sockets.
 *
 * Process the publsihed events - or messages on the SUBS.
 * Process the survey events - or messages on the RESP sockets
 *
 * Process the REQandREPL packets.. The REQ is an outgoing packet and the REPLY
 * is an incoming packet. Do we have a matching problem? Guess not.

 * When a process writes packets into the thread facing queue, the lock needs to be
 * unlocked..
