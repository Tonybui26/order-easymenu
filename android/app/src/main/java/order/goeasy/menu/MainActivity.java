package order.goeasy.menu;

import com.getcapacitor.BridgeActivity;

// Import our custom plugin
import com.yourapp.printertcpsocket.PrinterTcpSocketPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register our custom plugin
        registerPlugin(PrinterTcpSocketPlugin.class);
    }
}
