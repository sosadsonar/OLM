# OLM Auto-Solver

<div align="center">

[![Language: English](https://img.shields.io/badge/Language-English-red.svg)](https://github.com/sosadsonar/OLM/blob/main/README.md)

</div>

___
### ⚖️ Miễn trừ trách nhiệm pháp lý
> [!IMPORTANT]
> Công cụ này được cung cấp **duy nhất cho mục đích giáo dục và nghiên cứu**. Tác giả không chịu trách nhiệm về bất kỳ hành vi lạm dụng, mất mát dữ liệu hoặc vi phạm Điều khoản dịch vụ của bên thứ ba nào. Người dùng tự chịu mọi trách nhiệm pháp lý và rủi ro phát sinh trong quá trình sử dụng phần mềm.

---

### 🚀 Hướng dẫn cài đặt
#### **PC**
#### 1. Yêu cầu hệ thống
Để thực thi script, bạn cần cài đặt một trình quản lý userscript trên trình duyệt:
*   **Khuyên dùng:** [Tampermonkey](https://www.tampermonkey.net/)
*   *Lưu ý: Độ tương thích với các trình quản lý khác hiện chưa được kiểm thử chính thức.*

#### 2. Cấu hình trình duyệt
Để đảm bảo các userscript có đủ quyền thực thi, vui lòng tham khảo [hướng dẫn chính thức từ Tampermonkey](https://www.tampermonkey.net/faq.php?locale=en&q=Q209) về việc thiết lập quyền truy cập script.

#### 3. Các bước thiết lập
1.  Truy cập vào mục **Releases** của kho lưu trữ này.
2.  Chọn phiên bản mới nhất và nhấn vào tệp có đuôi `.user.js` để bắt đầu.
3.  Cửa sổ xác nhận của Tampermonkey sẽ xuất hiện; nhấn **Install** (Cài đặt) để hoàn tất.
4.  **Liên kết cài đặt nhanh:** [Nhấn vào đây để cài đặt](https://github.com/sosadsonar/OLM/releases/latest/download/OLM.Auto.Solver.user.js)

---

#### **Thiết bị di động**
Để triển khai công cụ trên điện thoại:
1.  Cài đặt trình duyệt **Firefox**.
2.  Cài đặt tiện ích mở rộng **Tampermonkey** thông qua mục Add-ons của Firefox.
3.  Thực hiện các bước cài đặt tương tự như trên máy tính.

---

### 📖 Hướng dẫn sử dụng
Sau khi cài đặt thành công, bảng điều khiển của công cụ sẽ tự động xuất hiện ở **góc trên bên phải** màn hình khi bạn truy cập vào cổng thi OLM.

#### Truy xuất điểm số ẩn (Nâng cao)
Trong trường hợp điểm số không hiển thị sau khi hoàn thành bài thi, bạn có thể truy xuất dữ liệu gốc qua Developer Tools:
1.  Mở trình quản lý nhà phát triển (`F12` hoặc `Ctrl + Shift + I`).
2.  Chuyển sang tab **Sources**.
3.  Nhấn `Ctrl + F` để mở thanh tìm kiếm toàn cục.
4.  Tìm kiếm từ khóa `score` hoặc định vị chính xác giá trị gán cho biến `tn_score`.

---

### 🛠 Hỗ trợ kỹ thuật
Nếu gặp sự cố trong quá trình cài đặt hoặc vận hành, vui lòng cập nhật trình quản lý userscript lên phiên bản mới nhất hoặc gửi phản hồi qua mục **Issues** của kho lưu trữ.
