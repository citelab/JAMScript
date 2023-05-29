var total_requests = 0;
var sleep_amount = 1;
var should_slowdown = false;


jtask function request_slowdown() {
    should_slowdown = true;
}
async function sleep(duration)
{
    return new Promise(resolve => setTimeout(resolve, duration));
}

async function main_loop() {
    var next_number = 1;
    while(true) {
        if(should_slowdown) {    
            console.log("DEMO: Worker requested to be given less work.");
            sleep_amount++;
            await sleep(100);
            should_slowdown = false;
        }
            
        compute_factorial(next_number);

        next_number++;
        // to prevent integer overflow
        next_number %= 12; 
        
        total_requests++;

        if(total_requests % 500) {
            console.log(get_factorial_status());
        }

        await sleep(sleep_amount);
    }
}

main_loop();