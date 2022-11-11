export class WebcamUtil {
    /**
     * Lists available videoInput devices
     * @returns a list of media device info.
     */
    static getAvailableVideoInputs() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return Promise.reject('enumerateDevices() not supported.');
        }
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.enumerateDevices()
                .then((devices) => {
                resolve(devices.filter((device) => device.kind === 'videoinput'));
            })
                .catch(err => {
                reject(err.message || err);
            });
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViY2FtLnV0aWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBwL21vZHVsZXMvd2ViY2FtL3V0aWwvd2ViY2FtLnV0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTSxPQUFPLFVBQVU7SUFFckI7OztPQUdHO0lBQ0ksTUFBTSxDQUFDLHVCQUF1QjtRQUNuQyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLEVBQUU7WUFDdkUsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLG1DQUFtQyxDQUFDLENBQUM7U0FDNUQ7UUFFRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLFNBQVMsQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLEVBQUU7aUJBQ3RDLElBQUksQ0FBQyxDQUFDLE9BQTBCLEVBQUUsRUFBRTtnQkFDbkMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUF1QixFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDckYsQ0FBQyxDQUFDO2lCQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDWCxNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxHQUFHLENBQUMsQ0FBQztZQUM3QixDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNsYXNzIFdlYmNhbVV0aWwge1xyXG5cclxuICAvKipcclxuICAgKiBMaXN0cyBhdmFpbGFibGUgdmlkZW9JbnB1dCBkZXZpY2VzXHJcbiAgICogQHJldHVybnMgYSBsaXN0IG9mIG1lZGlhIGRldmljZSBpbmZvLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0aWMgZ2V0QXZhaWxhYmxlVmlkZW9JbnB1dHMoKTogUHJvbWlzZTxNZWRpYURldmljZUluZm9bXT4ge1xyXG4gICAgaWYgKCFuYXZpZ2F0b3IubWVkaWFEZXZpY2VzIHx8ICFuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmVudW1lcmF0ZURldmljZXMpIHtcclxuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCdlbnVtZXJhdGVEZXZpY2VzKCkgbm90IHN1cHBvcnRlZC4nKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmVudW1lcmF0ZURldmljZXMoKVxyXG4gICAgICAgIC50aGVuKChkZXZpY2VzOiBNZWRpYURldmljZUluZm9bXSkgPT4ge1xyXG4gICAgICAgICAgcmVzb2x2ZShkZXZpY2VzLmZpbHRlcigoZGV2aWNlOiBNZWRpYURldmljZUluZm8pID0+IGRldmljZS5raW5kID09PSAndmlkZW9pbnB1dCcpKTtcclxuICAgICAgICB9KVxyXG4gICAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgICAgcmVqZWN0KGVyci5tZXNzYWdlIHx8IGVycik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19