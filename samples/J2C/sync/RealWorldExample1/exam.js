function exam() {
    var p = distributeExams();
    var q = startExam();
    console.log('Started the exams');
}

setInterval(function() {
        exam();
        }, 20000);
