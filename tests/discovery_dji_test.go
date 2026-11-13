package device

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestDiscoverFallbackDJIQDC507(t *testing.T) {
	for _, tc := range []struct {
		name     string
		vid, pid string
		want     bool
	}{
		{"DJI QDC507", "2ca3", "4006", true},
		{"other DJI device", "2ca3", "4007", false},
		{"unrelated vendor", "1234", "4006", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			usb := filepath.Join(t.TempDir(), "2-1")
			if err := os.MkdirAll(usb, 0755); err != nil {
				t.Fatal(err)
			}
			for name, value := range map[string]string{"idVendor": tc.vid, "idProduct": tc.pid} {
				if err := os.WriteFile(filepath.Join(usb, name), []byte(value), 0644); err != nil {
					t.Fatal(err)
				}
			}
			for i := 0; i < 5; i++ {
				// Shift global tty numbers to ensure the device-local AT interface is used.
				p := filepath.Join(usb, fmt.Sprintf("2-1:1.%d", i), fmt.Sprintf("ttyUSB%d", i+5))
				if err := os.MkdirAll(p, 0755); err != nil {
					t.Fatal(err)
				}
			}
			got, ok := discoverFallbackOne(usb)
			if ok != tc.want {
				t.Fatalf("accepted=%v want %v", ok, tc.want)
			}
			if ok && got.ATPort != "/dev/ttyUSB7" {
				t.Fatalf("ATPort=%q want /dev/ttyUSB7", got.ATPort)
			}
		})
	}
}
