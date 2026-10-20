export class TimeKit {
    /*
    * @return e.g.'2024-06-13 10:21:16.245'
    */
    static getCurrentTimeString() {
        let date = new Date();
        let year = date.getFullYear(),
            month = (date.getMonth() + 1).toString().padStart(2, '0'), // 月份从0开始
            day = date.getDate().toString().padStart(2, '0'),
            hours = date.getHours().toString().padStart(2, '0'),
            minutes = date.getMinutes().toString().padStart(2, '0'),
            seconds = date.getSeconds().toString().padStart(2, '0'),
            milliseconds = date.getMilliseconds().toString().padStart(3, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

}