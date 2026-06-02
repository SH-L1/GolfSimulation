
import torch
import torch.nn as nn
from MobileNetV2 import MobileNetV2


class EventDetector(nn.Module):
    def __init__(self, pretrain, width_mult, lstm_layers, lstm_hidden,
                 bidirectional=True, dropout=True):
        super(EventDetector, self).__init__()
        self.width_mult    = width_mult
        self.lstm_layers   = lstm_layers
        self.lstm_hidden   = lstm_hidden
        self.bidirectional = bidirectional
        self.dropout       = dropout

        net = MobileNetV2(width_mult=width_mult)

        #  Fix 1: pretrain=True | LÌ | \Ü
        #          pretrain=False t œd 0T (´(< swingnet X\ n´)
        if pretrain:
            import os
            pth = os.path.join(os.path.dirname(__file__), 'mobilenet_v2.pth.tar')
            state_dict = torch.load(pth, map_location='cpu')
            net.load_state_dict(state_dict)

        self.cnn = nn.Sequential(*list(net.children())[0][:19])
        self.rnn = nn.LSTM(
            int(1280 * width_mult if width_mult > 1.0 else 1280),
            self.lstm_hidden,
            self.lstm_layers,
            batch_first=True,
            bidirectional=bidirectional,
        )
        if self.bidirectional:
            self.lin = nn.Linear(2 * self.lstm_hidden, 9)
        else:
            self.lin = nn.Linear(self.lstm_hidden, 9)
        if self.dropout:
            self.drop = nn.Dropout(0.5)

    def init_hidden(self, batch_size, device):
        #  Fix 2: .cuda() XÜT) p ’ device |ø0\ ˜¬
        num_dir = 2 if self.bidirectional else 1
        return (
            torch.zeros(num_dir * self.lstm_layers, batch_size,
                        self.lstm_hidden, device=device, requires_grad=True),
            torch.zeros(num_dir * self.lstm_layers, batch_size,
                        self.lstm_hidden, device=device, requires_grad=True),
        )

    def forward(self, x, lengths=None):
        batch_size, timesteps, C, H, W = x.size()
        device = x.device

        #  Fix 3: init_hiddenÐ device ì
        self.hidden = self.init_hidden(batch_size, device)

        # CNN forward
        c_in  = x.view(batch_size * timesteps, C, H, W)
        c_out = self.cnn(c_in)
        c_out = c_out.mean(3).mean(2)
        if self.dropout:
            c_out = self.drop(c_out)

        # LSTM forward
        r_in          = c_out.view(batch_size, timesteps, -1)
        r_out, states = self.rnn(r_in, self.hidden)
        out           = self.lin(r_out)
        out           = out.view(batch_size * timesteps, 9)

        return out
